/**
 * LLM-driven user for AI scenario runs.
 *
 * The AI is given a self-contained scenario (which includes the exit
 * conditions and pass/fail criteria) plus the full conversation so far, and
 * decides what the simulated user would do next:
 *   - respond to a frontend tool call with a tool response, OR
 *   - reply with a text message, OR
 *   - stop the test and emit a pass/fail verdict.
 *
 * The AI is the sole authority on when the scenario is complete — the runner
 * does not carry step expectations.
 */
import { AI_USER_API_KEY, AI_USER_MODEL, AI_USER_URL } from '../config'
import { TOOL_DEFS } from '../tools'
import type { AiUserConfig, AiVerdict, RecordedStep } from './types'

// ---------------------------------------------------------------------------
// Decision + context types
// ---------------------------------------------------------------------------

export type AiUserDecision =
  | { action: 'respond_tool'; response: Record<string, unknown> }
  | { action: 'respond_text'; text: string }
  | { action: 'stop'; verdict: AiVerdict; reason: string }

export type AiUserContext =
  | {
      kind: 'tool'
      toolName: string
      toolArgs: Record<string, unknown>
    }
  | {
      kind: 'text'
      assistantText: string
    }

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function toolsCatalog(): string {
  return TOOL_DEFS.map((t) => `### \`${t.name}\`\n${t.description}`).join('\n\n')
}

function formatConversation(steps: RecordedStep[]): string {
  const lines: string[] = []
  let currentRound = 0
  for (const step of steps) {
    if (step.round !== currentRound) {
      currentRound = step.round
      lines.push(`--- Round ${currentRound} ---`)
    }
    switch (step.type) {
      case 'assistant_text':
        lines.push(`[assistant text] ${step.text}`)
        break
      case 'tool_call':
        lines.push(`[${step.source} tool call] ${step.tool} args=${step.args}`)
        if (step.result) lines.push(`  -> ${step.result.slice(0, 300)}`)
        break
      case 'user_tool_response':
        lines.push(`[user -> ${step.tool}] ${step.response.slice(0, 300)}`)
        break
      case 'user_text':
        lines.push(`[user text] ${step.text}`)
        break
      case 'error':
        lines.push(`[error] ${step.message}`)
        break
    }
  }
  return lines.join('\n')
}

function buildSystemPrompt(ai: AiUserConfig): string {
  return [
    'You are a QA tester simulating a human user in an end-to-end test of a chat agent.',
    'You play the user role. You decide how to respond to every UI tool call and every text message from the agent,',
    'and you decide when the test is complete (by emitting a verdict).',
    '',
    '## Your scenario (includes exit conditions)',
    ai.scenario.trim(),
    ...(ai.instructions ? ['', '## Additional guidance', ai.instructions.trim()] : []),
    '',
    '## UI tools the agent may invoke',
    'Each tool description below lists the tool name, purpose, and response fields.',
    "When you respond to a tool call, produce a JSON object matching that tool's response shape.",
    '',
    toolsCatalog(),
    '',
    '## How to respond',
    'Always return a single JSON object. Do not wrap it in Markdown.',
    'Choose exactly one of the following actions:',
    '',
    '  { "action": "respond_tool", "response": <JSON matching the tool response shape> }',
    '    — when the agent invoked a frontend tool and is waiting for a user answer.',
    '',
    '  { "action": "respond_text", "text": "<user message>" }',
    '    — when the agent sent a plain-text message and is waiting for a user reply.',
    '',
    '  { "action": "stop", "verdict": "pass" | "fail", "reason": "<short explanation>" }',
    '    — emit this whenever the scenario has reached its natural endpoint',
    '      (pass/fail as described in the scenario above). Always pick a verdict.',
    '',
    '## Response quality rules',
    '- NEVER return an empty response object (`{}`) for `respond_tool` — that gives the agent nothing',
    '  to act on and creates a loop where the same tool is invoked again.',
    '- When the scenario says "accept the defaults" and you do not know the exact default values,',
    '  set `userMessage` to a short explicit note like "accept defaults" so the agent applies its',
    '  own defaults and moves on.',
    '- Use the tool response fields described in the catalog above; do not invent fields that are',
    '  not listed there.',
    '',
    '## Verdict rules',
    '- Use verdict="pass" if the conversation has reached the success condition described in the scenario.',
    '- Use verdict="fail" if the agent diverged from the scenario — skipped a required step, asked for',
    '  data the scenario already provided, looped, or produced unexpected output.',
    '- Also use verdict="fail" if you cannot produce a valid response for some reason.',
    '- If you see the same tool being invoked multiple times in a row without progress, stop the run',
    '  with verdict="fail" and describe the loop in the reason.',
    '- Keep the reason short (one sentence).',
  ].join('\n')
}

function buildUserPrompt(ctx: AiUserContext, steps: RecordedStep[]): string {
  const transcript = formatConversation(steps) || '(empty — conversation has not started yet)'
  const task =
    ctx.kind === 'tool'
      ? [
          `The agent just invoked the UI tool \`${ctx.toolName}\`.`,
          'Tool arguments:',
          '```json',
          JSON.stringify(ctx.toolArgs, null, 2),
          '```',
          'Decide: either respond to this tool call, or stop the test if the scenario is complete or has diverged.',
        ].join('\n')
      : [
          'The agent just sent this text message and is waiting for a user reply:',
          '```',
          ctx.assistantText,
          '```',
          'Decide: either reply with a text message, or stop the test if the scenario is complete or has diverged.',
        ].join('\n')

  return ['## Conversation so far', transcript, '', '## Your task', task].join('\n')
}

// ---------------------------------------------------------------------------
// HTTP call
// ---------------------------------------------------------------------------

interface ChatCompletionChoice {
  message?: { content?: string }
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[]
}

async function callLlm(system: string, user: string, temperature: number): Promise<string> {
  if (!AI_USER_URL || !AI_USER_API_KEY || !AI_USER_MODEL) {
    throw new Error(
      'AI user is not configured. Fill in AI_USER_URL, AI_USER_API_KEY, and AI_USER_MODEL in config.ts.',
    )
  }

  const response = await fetch(AI_USER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_USER_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_USER_MODEL,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`AI user call failed: HTTP ${response.status} — ${body.slice(0, 500)}`)
  }

  const payload = (await response.json()) as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI user returned empty content')
  }
  return content
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Extract the first top-level JSON object from `raw`, skipping any leading
 * whitespace or preamble and tolerating extra content after the object closes.
 * Useful when the provider occasionally emits the same JSON twice or adds
 * stray characters outside the object.
 */
function extractFirstJsonObject(raw: string): unknown {
  const start = raw.indexOf('{')
  if (start < 0) throw new Error('no `{` found')

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return JSON.parse(raw.slice(start, i + 1))
      }
    }
  }
  throw new Error('unterminated JSON object')
}

function parseDecision(raw: string): AiUserDecision {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Fallback: some providers return the same JSON twice (streaming leak,
    // relay quirk, etc.) or add stray text. Pull out the first well-formed
    // JSON object and use that.
    try {
      parsed = extractFirstJsonObject(raw)
      console.log(
        `  [AI WARN] provider returned multiple/invalid JSON chunks; parsed the first object`,
      )
    } catch (err) {
      throw new Error(
        `AI user returned non-JSON content: ${err instanceof Error ? err.message : String(err)} — raw: ${raw.slice(0, 300)}`,
      )
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`AI user returned non-object JSON: ${raw.slice(0, 300)}`)
  }

  const obj = parsed as Record<string, unknown>
  const action = obj.action

  if (action === 'respond_tool') {
    const response = obj.response
    if (!response || typeof response !== 'object') {
      throw new Error(`AI user action=respond_tool is missing a response object: ${raw.slice(0, 300)}`)
    }
    return { action: 'respond_tool', response: response as Record<string, unknown> }
  }
  if (action === 'respond_text') {
    const text = obj.text
    if (typeof text !== 'string') {
      throw new Error(`AI user action=respond_text is missing text: ${raw.slice(0, 300)}`)
    }
    return { action: 'respond_text', text }
  }
  if (action === 'stop') {
    const verdictRaw = obj.verdict
    const verdict: AiVerdict = verdictRaw === 'pass' ? 'pass' : 'fail'
    const reason = typeof obj.reason === 'string' ? obj.reason : 'no reason provided'
    return { action: 'stop', verdict, reason }
  }

  throw new Error(`AI user returned unknown action=${String(action)} — raw: ${raw.slice(0, 300)}`)
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export async function askAiUser(
  ai: AiUserConfig,
  ctx: AiUserContext,
  steps: RecordedStep[],
): Promise<AiUserDecision> {
  const system = buildSystemPrompt(ai)
  const user = buildUserPrompt(ctx, steps)
  const raw = await callLlm(system, user, ai.temperature ?? 0.2)
  return parseDecision(raw)
}
