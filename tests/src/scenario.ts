/**
 * Scenario-based integration test runner for AG-UI translation flows.
 *
 * Two-phase design:
 *
 *   Phase 1 — Execution:
 *     UserConfig describes how the simulated user behaves: tool handlers,
 *     text replies, round/message limits. runScenario() executes the agent
 *     flow with this config and records every event as RecordedStep[].
 *
 *   Phase 2 — Verification (optional):
 *     ExpectedScenario declares the expected order of tool calls / text rounds.
 *     verifySteps() matches recorded steps against expectations and returns
 *     a structured pass/fail result.
 *
 * Separating execution from verification means the same run data can be:
 *   - verified against an expected scenario
 *   - inspected manually in logs (no verification)
 *   - analyzed programmatically
 */
import { HttpAgent, randomUUID } from '@ag-ui/client'
import type { RunAgentInput, ToolCall } from '@ag-ui/client'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SERVER_URL, TOKEN } from './config'
import { uploadTestFiles, type FileInput } from './drive'
import { TOOL_DEFS, type ToolHandler } from './tools'

// ---------------------------------------------------------------------------
// User action configuration
// ---------------------------------------------------------------------------

export interface UserConfig {
  name: string
  message: string
  files: FileInput[]
  /** Handlers for frontend tools. Key = tool name, value = handler function. */
  handlers: Record<string, ToolHandler>
  /** Default text reply when agent asks a question (default: "ok") */
  textReply?: string
  /** Maximum rounds to run (default: 20) */
  maxRounds?: number
  /** Maximum text messages from user — safety limit to prevent infinite conversation (default: 5) */
  maxTextMessages?: number
  /**
   * Stop the scenario as soon as a tool call matches this predicate.
   * Called for every recorded tool call (frontend and backend). If it returns
   * true, the run is terminated immediately AFTER the tool call is recorded
   * but BEFORE any handler is invoked — so the matched tool call appears as
   * the last step in the result, without a user response.
   */
  stopOnToolCall?: (toolName: string, args: Record<string, unknown>) => boolean
}

// ---------------------------------------------------------------------------
// Recorded steps
// ---------------------------------------------------------------------------

export type RecordedStep =
  | { type: 'assistant_text'; round: number; text: string }
  | { type: 'tool_call'; round: number; tool: string; toolCallId: string; source: 'frontend' | 'backend'; args: string; result?: string }
  | { type: 'user_tool_response'; round: number; tool: string; toolCallId: string; response: string }
  | { type: 'user_text'; round: number; text: string }
  | { type: 'error'; round: number; message: string }

export type StopReason =
  | 'flow_ended' // Agent produced neither tool calls nor text — natural end
  | 'max_rounds' // Round limit reached
  | 'max_text_messages' // Text reply safety limit reached
  | 'stop_on_tool_call' // stopOnToolCall predicate matched
  | 'missing_handler' // No handler registered for a frontend tool
  | 'run_error' // Run error or exception from the agent stream

export interface RunResult {
  steps: RecordedStep[]
  rounds: number
  /** Why the run ended. */
  stopReason: StopReason
  /** Human-readable detail attached to the stop (tool name, message, etc.). */
  stopDetail?: string
  /** Name of the scenario that produced this result. */
  name: string
}

// ---------------------------------------------------------------------------
// Expected scenario (for verification)
// ---------------------------------------------------------------------------

export interface FlowToolStep {
  tool: string
  resultContains?: string
  count?: number
  optional?: boolean
  /** Called during verification when the step matches. Throw to fail. */
  check?: (args: Record<string, unknown>, result: string | undefined) => void
}

export interface FlowTextStep {
  text: true
  /** If set, the text message must contain this substring */
  contains?: string
  count?: number
  optional?: boolean
}

export type FlowStep = FlowToolStep | FlowTextStep

/** A repeating group of steps. The entire block repeats `count` times. */
export interface FlowBlock {
  block: FlowStep[]
  count: number
}

export type FlowEntry = FlowStep | FlowBlock

export interface ExpectedScenario {
  steps: FlowEntry[]
  /** Tool name patterns that are always allowed anywhere in the flow (prefix or regex) */
  optionalTools?: Array<string | RegExp>
}

export interface VerifyResult {
  success: boolean
  error: string | null
  matchedSteps: Array<{ step: string; round: number }>
}

// ---------------------------------------------------------------------------
// Agent wrapper
// ---------------------------------------------------------------------------

class HttpAgentWithHeaders extends HttpAgent {
  protected requestInit(input: RunAgentInput): RequestInit {
    return super.requestInit(input)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBlock(entry: FlowEntry): entry is FlowBlock {
  return 'block' in entry
}

function isTextStep(step: FlowStep): step is FlowTextStep {
  return 'text' in step
}

function isToolStep(step: FlowStep): step is FlowToolStep {
  return 'tool' in step
}

function stepLabel(step: FlowStep): string {
  if (isTextStep(step)) {
    let label = '[text]'
    if (step.contains) label += ` (contains "${step.contains}")`
    if (step.count && step.count > 1) label += ` x${step.count}`
    if (step.optional) label += ' [optional]'
    return label
  }
  let label = step.tool
  if (step.resultContains) label += ` (contains "${step.resultContains}")`
  if (step.count && step.count > 1) label += ` x${step.count}`
  if (step.optional) label += ' [optional]'
  return label
}

function entryLabel(entry: FlowEntry): string {
  if (isBlock(entry)) {
    const inner = entry.block.map(stepLabel).join(', ')
    return `[${inner}] x${entry.count}`
  }
  return stepLabel(entry)
}

/** Expand FlowEntry[] into a flat FlowStep[] list. */
function expandEntries(entries: FlowEntry[]): FlowStep[] {
  const result: FlowStep[] = []
  for (const entry of entries) {
    if (isBlock(entry)) {
      for (let i = 0; i < entry.count; i++) {
        for (const s of entry.block) {
          result.push({ ...s, count: undefined })
        }
      }
    } else {
      const n = entry.count ?? 1
      for (let i = 0; i < n; i++) {
        result.push({ ...entry, count: undefined })
      }
    }
  }
  return result
}

/** Check if a tool name matches any of the scenario-level optional patterns. */
function isOptionalTool(toolName: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((p) =>
    typeof p === 'string' ? toolName.startsWith(p) : p.test(toolName),
  )
}

/** Try to match a tool call against a tool step. */
function matchesToolStep(
  step: FlowStep,
  toolName: string,
  resultContent: string | undefined,
): boolean {
  if (!isToolStep(step)) return false
  if (toolName !== step.tool) return false
  if (
    step.resultContains &&
    (!resultContent || !resultContent.includes(step.resultContains))
  )
    return false
  return true
}

/** Try to match a text-only round against a text step. */
function matchesTextStep(step: FlowStep, textContent: string): boolean {
  if (!isTextStep(step)) return false
  if (step.contains && !textContent.includes(step.contains)) return false
  return true
}

// ---------------------------------------------------------------------------
// Cursor matching — advance cursor on match, skip optional steps
// ---------------------------------------------------------------------------

interface MatchResult {
  matched: boolean
  newCursor: number
}

function tryMatchCursor(
  expanded: FlowStep[],
  cursor: number,
  matchFn: (step: FlowStep) => boolean,
): MatchResult {
  let searchIdx = cursor

  while (searchIdx < expanded.length) {
    const candidate = expanded[searchIdx]!
    if (matchFn(candidate)) {
      // Check that all steps between cursor and searchIdx are optional
      for (let si = cursor; si < searchIdx; si++) {
        if (!expanded[si]!.optional) {
          return { matched: false, newCursor: cursor }
        }
      }
      return { matched: true, newCursor: searchIdx + 1 }
    }

    if (expanded[searchIdx]!.optional) {
      searchIdx++
      continue
    }

    break
  }

  return { matched: false, newCursor: cursor }
}

// ---------------------------------------------------------------------------
// Runner — executes the flow and records every event
// ---------------------------------------------------------------------------

export async function runScenario(config: UserConfig): Promise<RunResult> {
  if (config.files.length === 0) {
    throw new Error(
      `Scenario "${config.name}" has no files. Add test files to the scenario's files/ directory.`,
    )
  }

  const maxRounds = config.maxRounds ?? 20
  const maxTextMessages = config.maxTextMessages ?? 5
  const textReply = config.textReply ?? 'ok'

  const steps: RecordedStep[] = []
  let textMessageCount = 0
  let stopReason: StopReason = 'max_rounds'
  let stopDetail: string | undefined

  console.log(`\n=== Scenario: ${config.name} ===`)
  console.log(`  Files: ${config.files.map((f) => path.basename(f.path)).join(', ')}`)
  console.log(`  Message: "${config.message}"`)
  console.log(`  Handlers: ${Object.keys(config.handlers).join(', ')}`)
  console.log(`  Max rounds: ${maxRounds}, max text messages: ${maxTextMessages}`)

  // 1. Upload files
  const driveFiles = await uploadTestFiles(config.files)

  // 2. Build initial messages
  const headers: Record<string, string> = {}
  if (TOKEN) headers['X-Token'] = TOKEN

  const agent = new HttpAgentWithHeaders({ url: SERVER_URL, headers })

  agent.addMessage({ id: randomUUID(), role: 'user', content: config.message })

  if (driveFiles.length > 0) {
    const fileInfoPayload = driveFiles.map((f) => ({
      mimeType: f.mimeType,
      fileDriveId: f.fileId,
      fileName: f.name,
    }))
    agent.addMessage({
      id: randomUUID(),
      role: 'developer',
      content: JSON.stringify(fileInfoPayload),
    })
  }

  // 3. Run AG-UI loop
  let round = 0

  while (round < maxRounds) {
    round++
    console.log(`\n--- Round ${round} ---`)

    const pendingToolCalls: ToolCall[] = []
    const serverResolvedToolIds = new Set<string>()
    const toolResultContents = new Map<string, string>()
    const textMessages: string[] = []
    let currentMessageText = ''
    let hasError = false

    // --- SSE stream ---
    const runComplete = await new Promise<boolean>((resolve) => {
      const subscription = agent.subscribe({
        onRunStartedEvent() {
          console.log(`  [RUN_STARTED]`)
        },
        onTextMessageStartEvent() {
          currentMessageText = ''
        },
        onTextMessageContentEvent({ event }) {
          currentMessageText += event.delta ?? ''
        },
        onTextMessageEndEvent() {
          if (currentMessageText.trim()) {
            console.log(`  [TEXT] ${currentMessageText.trim()}`)
            textMessages.push(currentMessageText.trim())
          }
          currentMessageText = ''
        },
        onNewToolCall({ toolCall }) {
          const argsStr = toolCall.function.arguments || '{}'
          console.log(`  |${toolCall.id}| [TOOL_CALL] ${toolCall.function.name} args=${argsStr.slice(0, 300)}`)
          pendingToolCalls.push(toolCall)
        },
        onToolCallResultEvent({ event }) {
          const content = event.content ?? ''
          console.log(
            `  |${event.toolCallId}| [TOOL_RESULT] content=${content.slice(0, 200)}`,
          )
          serverResolvedToolIds.add(event.toolCallId)
          toolResultContents.set(event.toolCallId, content)
        },
        onRunFinishedEvent() {
          console.log(`  [ROUND_END]`)
          subscription.unsubscribe()
          resolve(true)
        },
        onRunErrorEvent({ event }) {
          console.log(`  [RUN_ERROR] ${event.message}`)
          hasError = true
          subscription.unsubscribe()
          resolve(false)
        },
      })

      agent.runAgent({ tools: TOOL_DEFS }).catch((err: unknown) => {
        console.log(`  [EXCEPTION] ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
        subscription.unsubscribe()
        resolve(false)
      })
    })

    // Record assistant text
    for (const text of textMessages) {
      steps.push({ type: 'assistant_text', round, text })
    }

    if (!runComplete || hasError) {
      steps.push({ type: 'error', round, message: 'Run error or exception' })
      stopReason = 'run_error'
      stopDetail = 'Run error or exception from the agent stream'
      break
    }

    // Record tool calls
    let shouldStop = false
    for (const tc of pendingToolCalls) {
      const source: 'frontend' | 'backend' = serverResolvedToolIds.has(tc.id)
        ? 'backend'
        : 'frontend'
      steps.push({
        type: 'tool_call',
        round,
        tool: tc.function.name,
        toolCallId: tc.id,
        source,
        args: tc.function.arguments || '{}',
        result: toolResultContents.get(tc.id),
      })

      if (config.stopOnToolCall) {
        const parsedArgs = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
        if (config.stopOnToolCall(tc.function.name, parsedArgs)) {
          console.log(`  [STOP] stopOnToolCall matched on "${tc.function.name}" — ending run`)
          shouldStop = true
          stopReason = 'stop_on_tool_call'
          stopDetail = `stopOnToolCall matched on "${tc.function.name}"`
        }
      }
    }

    if (shouldStop) break

    const hasToolCalls = pendingToolCalls.length > 0
    const hasText = textMessages.length > 0

    const frontendToolCalls = pendingToolCalls.filter(
      (tc) => !serverResolvedToolIds.has(tc.id),
    )
    const hasFrontendToolCalls = frontendToolCalls.length > 0

    // =================================================================
    // CASE 1: Round has frontend tool calls — respond with handler output
    // =================================================================
    if (hasFrontendToolCalls) {
      if (hasText) {
        console.log(`  (text alongside frontend tool calls — informational)`)
      }

      let missingHandler: string | null = null
      for (const tc of frontendToolCalls) {
        const name = tc.function.name
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
        const handler = config.handlers[name]

        if (!handler) {
          missingHandler = name
          console.log(`  [ABORT] No handler for frontend tool "${name}" — ending run`)
          steps.push({
            type: 'error',
            round,
            message: `No handler for frontend tool "${name}"`,
          })
          stopReason = 'missing_handler'
          stopDetail = `No handler for frontend tool "${name}"`
          break
        }

        const response = handler(args)
        console.log(`  -> ${name}: ${response.slice(0, 120)}`)

        steps.push({
          type: 'user_tool_response',
          round,
          tool: name,
          toolCallId: tc.id,
          response,
        })

        agent.addMessage({
          id: randomUUID(),
          role: 'tool',
          toolCallId: tc.id,
          content: response,
        })
      }

      if (missingHandler) break

      continue
    }

    // =================================================================
    // CASE 2: Text produced without any frontend tool calls — the assistant
    // is addressing the user directly. Send a text reply so the flow can
    // continue. Backend tool calls (e.g. handoffs) are pass-through noise
    // from the framework and don't affect this decision.
    // =================================================================
    if (hasText) {
      if (hasToolCalls) {
        console.log(`  (backend tool calls alongside text — treating as text round)`)
      }
      if (textMessageCount < maxTextMessages) {
        textMessageCount++
        console.log(`  -> User reply: "${textReply}" (${textMessageCount}/${maxTextMessages})`)
        steps.push({ type: 'user_text', round, text: textReply })
        agent.addMessage({ id: randomUUID(), role: 'user', content: textReply })
      } else {
        console.log(`  Max text messages (${maxTextMessages}) reached, stopping`)
        steps.push({
          type: 'error',
          round,
          message: `Max text messages (${maxTextMessages}) reached`,
        })
        stopReason = 'max_text_messages'
        stopDetail = `Max text messages (${maxTextMessages}) reached`
        break
      }

      continue
    }

    // =================================================================
    // CASE 3: No tool calls and no text — flow ended
    // =================================================================
    console.log(`  No tool calls and no text — flow ended.`)
    stopReason = 'flow_ended'
    stopDetail = 'Agent produced neither tool calls nor text'
    break
  }

  // If the while loop exited by its condition (no break), we hit max rounds.
  if (stopReason === 'max_rounds' && round >= maxRounds) {
    stopDetail = `Max rounds (${maxRounds}) reached`
  }

  console.log(
    `\n=== Run complete: ${round} rounds, ${steps.length} recorded steps ===`,
  )
  console.log(`  Stop reason: ${stopReason}${stopDetail ? ` — ${stopDetail}` : ''}`)
  return { steps, rounds: round, stopReason, stopDetail, name: config.name }
}

// ---------------------------------------------------------------------------
// Verification — match recorded steps against expected scenario
// ---------------------------------------------------------------------------

export function verifySteps(result: RunResult, expected: ExpectedScenario): VerifyResult {
  const expanded = expandEntries(expected.steps)
  const optPatterns = expected.optionalTools ?? []
  const matchedSteps: VerifyResult['matchedSteps'] = []
  let cursor = 0
  let error: string | null = null

  console.log(`\n=== Verifying against ${expanded.length} expected steps ===`)
  console.log(`  Expected: ${expected.steps.map(entryLabel).join(', ')}`)

  // Group recorded steps by round
  const roundMap = new Map<number, RecordedStep[]>()
  for (const step of result.steps) {
    const round = step.round
    if (!roundMap.has(round)) roundMap.set(round, [])
    roundMap.get(round)!.push(step)
  }

  const roundNumbers = [...roundMap.keys()].sort((a, b) => a - b)

  for (const roundNum of roundNumbers) {
    if (error) break

    const roundSteps = roundMap.get(roundNum)!
    const toolCalls = roundSteps.filter(
      (s): s is Extract<RecordedStep, { type: 'tool_call' }> => s.type === 'tool_call',
    )
    const assistantTexts = roundSteps.filter(
      (s): s is Extract<RecordedStep, { type: 'assistant_text' }> =>
        s.type === 'assistant_text',
    )

    // ===== Tool calls =====
    for (const tc of toolCalls) {
      if (error) break

      if (cursor >= expanded.length) {
        if (isOptionalTool(tc.tool, optPatterns)) {
          console.log(`  R${roundNum}: ~ ${tc.tool} (optional, after all steps)`)
          continue
        }
        error = `Unexpected tool call "${tc.tool}" after all expected steps completed`
        console.log(`  R${roundNum}: x ${error}`)
        break
      }

      const match = tryMatchCursor(expanded, cursor, (step) =>
        matchesToolStep(step, tc.tool, tc.result),
      )

      if (match.matched) {
        // Log skipped optional steps
        for (let si = cursor; si < match.newCursor - 1; si++) {
          console.log(`  R${roundNum}: ~ ${stepLabel(expanded[si]!)} (skipped)`)
        }

        const matchedStep = expanded[match.newCursor - 1]!
        console.log(`  R${roundNum}: + ${stepLabel(matchedStep)}`)

        // Run check callback
        if (isToolStep(matchedStep) && matchedStep.check) {
          try {
            const args = JSON.parse(tc.args) as Record<string, unknown>
            matchedStep.check(args, tc.result)
            console.log(`  R${roundNum}: + check passed`)
          } catch (err) {
            error = `Check failed for "${tc.tool}": ${err instanceof Error ? err.message : String(err)}`
            console.log(`  R${roundNum}: x ${error}`)
            break
          }
        }

        matchedSteps.push({ step: stepLabel(matchedStep), round: roundNum })
        cursor = match.newCursor
        continue
      }

      // Not matched — check scenario-level optional
      if (isOptionalTool(tc.tool, optPatterns)) {
        console.log(`  R${roundNum}: ~ ${tc.tool} (scenario optional)`)
        continue
      }

      // Check any optional step in the list
      const isKnownOptional = expanded.some(
        (s) => s.optional && matchesToolStep(s, tc.tool, tc.result),
      )
      if (isKnownOptional) {
        console.log(`  R${roundNum}: ~ ${tc.tool} (optional, out of order)`)
        continue
      }

      const expectedLabel = expanded[cursor] ? stepLabel(expanded[cursor]!) : '(end)'
      error = `Unexpected tool call "${tc.tool}" at step ${cursor + 1}/${expanded.length} (expected: ${expectedLabel})`
      console.log(`  R${roundNum}: x ${error}`)
      break
    }

    if (error) break

    // ===== Text (can appear with or without tool calls in the same round) =====
    if (assistantTexts.length > 0) {
      const textContent = assistantTexts.map((t) => t.text).join('\n')

      const match = tryMatchCursor(expanded, cursor, (step) =>
        matchesTextStep(step, textContent),
      )

      if (match.matched) {
        for (let si = cursor; si < match.newCursor - 1; si++) {
          console.log(`  R${roundNum}: ~ ${stepLabel(expanded[si]!)} (skipped)`)
        }
        const matchedStep = expanded[match.newCursor - 1]!
        console.log(`  R${roundNum}: + ${stepLabel(matchedStep)}`)
        matchedSteps.push({ step: stepLabel(matchedStep), round: roundNum })
        cursor = match.newCursor
      } else {
        // Check optional out of order
        const isKnownOptional = expanded.some(
          (s) => s.optional && matchesTextStep(s, textContent),
        )
        if (isKnownOptional) {
          console.log(`  R${roundNum}: ~ text (optional, out of order)`)
        } else {
          // Next expected step is a tool step — treat text as informational
          const nextStep = cursor < expanded.length ? expanded[cursor] : undefined
          if (nextStep && isToolStep(nextStep)) {
            console.log(
              `  R${roundNum}: ~ text (informational, next expected: "${nextStep.tool}")`,
            )
          } else if (cursor < expanded.length) {
            const expectedLabel = stepLabel(expanded[cursor]!)
            error = `Unexpected text at step ${cursor + 1}/${expanded.length} (expected: ${expectedLabel}). Text: "${textContent.slice(0, 100)}"`
            console.log(`  R${roundNum}: x ${error}`)
            break
          } else {
            // Past all expected steps — trailing text is fine, ignore
            console.log(`  R${roundNum}: ~ text (after all steps)`)
          }
        }
      }
    }

    // All steps completed?
    if (cursor >= expanded.length) {
      console.log(`\n=== All steps matched after round ${roundNum}! ===`)
      return { success: true, error: null, matchedSteps }
    }
  }

  // Check remaining required steps
  if (!error) {
    const remaining = expanded.slice(cursor).filter((s) => !s.optional)
    if (remaining.length > 0) {
      error = `Flow ended with ${remaining.length} required step(s) remaining: ${remaining.map(stepLabel).join(', ')}`
    }
  }

  const success = error === null
  console.log(`\n=== Verification: ${success ? 'PASS' : 'FAIL'} ===`)
  console.log(`  Matched: ${matchedSteps.map((s) => `R${s.round}:${s.step}`).join(', ')}`)
  if (error) console.log(`  Error: ${error}`)

  return { success, error, matchedSteps }
}

// ---------------------------------------------------------------------------
// Print utility — formatted summary of recorded steps
// ---------------------------------------------------------------------------

export function printSteps(steps: RecordedStep[]): void {
  let currentRound = 0
  for (const step of steps) {
    if (step.round !== currentRound) {
      currentRound = step.round
      console.log(`\n--- Round ${currentRound} ---`)
    }
    switch (step.type) {
      case 'assistant_text':
        console.log(`  [ASSISTANT] ${step.text.slice(0, 300)}`)
        break
      case 'tool_call':
        console.log(
          `  [TOOL_CALL] ${step.tool} (${step.source}) args=${step.args.slice(0, 200)}`,
        )
        if (step.result) console.log(`    result=${step.result.slice(0, 200)}`)
        break
      case 'user_tool_response':
        console.log(`  [USER -> ${step.tool}] ${step.response.slice(0, 120)}`)
        break
      case 'user_text':
        console.log(`  [USER] ${step.text}`)
        break
      case 'error':
        console.log(`  [ERROR] ${step.message}`)
        break
    }
  }

  // Summary
  const toolCalls = steps.filter(
    (s): s is Extract<RecordedStep, { type: 'tool_call' }> => s.type === 'tool_call',
  )
  const backendCalls = toolCalls.filter((s) => s.source === 'backend')
  const frontendCalls = toolCalls.filter((s) => s.source === 'frontend')
  const texts = steps.filter((s) => s.type === 'assistant_text')
  const userTexts = steps.filter((s) => s.type === 'user_text')
  const userToolResponses = steps.filter((s) => s.type === 'user_tool_response')
  const errors = steps.filter((s) => s.type === 'error')

  console.log(`\n=== Steps summary ===`)
  console.log(
    `  Tool calls: ${toolCalls.length} (${backendCalls.length} backend, ${frontendCalls.length} frontend)`,
  )
  console.log(`  Assistant messages: ${texts.length}`)
  console.log(
    `  User responses: ${userToolResponses.length} tool, ${userTexts.length} text`,
  )
  if (errors.length > 0) console.log(`  Errors: ${errors.length}`)
}

// ---------------------------------------------------------------------------
// HTML chat report — pretty transcript saved next to the test file
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

function truncateForHtml(s: string, limit = 4000): string {
  return s.length > limit ? s.slice(0, limit) + '\n… [truncated]' : s
}

function renderStepHtml(step: RecordedStep): string {
  switch (step.type) {
    case 'assistant_text':
      return `<div class="msg msg--assistant"><div class="bubble bubble--assistant">${escapeHtml(
        step.text,
      )}</div></div>`

    case 'user_text':
      return `<div class="msg msg--user"><div class="bubble bubble--user">${escapeHtml(
        step.text,
      )}</div></div>`

    case 'tool_call': {
      const badgeClass =
        step.source === 'backend' ? 'badge badge--backend' : 'badge badge--frontend'
      const argsFormatted = formatJson(step.args)
      const resultBlock = step.result
        ? `<details class="event__details"><summary>Result</summary><pre>${escapeHtml(
            truncateForHtml(step.result),
          )}</pre></details>`
        : ''
      return `<div class="event event--tool event--${step.source}">
        <div class="event__head">
          <span class="event__icon">🛠</span>
          <span class="event__title">${escapeHtml(step.tool)}</span>
          <span class="${badgeClass}">${step.source}</span>
        </div>
        <details class="event__details"><summary>Args</summary><pre>${escapeHtml(
          argsFormatted,
        )}</pre></details>
        ${resultBlock}
      </div>`
    }

    case 'user_tool_response':
      return `<div class="event event--response">
        <div class="event__head">
          <span class="event__icon">↩︎</span>
          <span class="event__title">User → ${escapeHtml(step.tool)}</span>
        </div>
        <details class="event__details" open><summary>Payload</summary><pre>${escapeHtml(
          formatJson(step.response),
        )}</pre></details>
      </div>`

    case 'error':
      return `<div class="event event--error">
        <span class="event__icon">⚠︎</span>
        <span class="event__title">${escapeHtml(step.message)}</span>
      </div>`
  }
}

function stopReasonTone(reason: StopReason): 'ok' | 'warn' | 'error' {
  switch (reason) {
    case 'flow_ended':
      return 'ok'
    case 'stop_on_tool_call':
      return 'ok'
    case 'max_rounds':
    case 'max_text_messages':
      return 'warn'
    case 'missing_handler':
    case 'run_error':
      return 'error'
  }
}

const HTML_STYLES = `
  :root {
    --bg: #f5f5f7;
    --card: #ffffff;
    --text: #1d1d1f;
    --muted: #6e6e73;
    --border: #e5e5ea;
    --user: #007aff;
    --assistant: #e9e9eb;
    --accent-warn: #ff9f0a;
    --accent-err: #ff3b30;
    --accent-ok: #30d158;
    --accent-backend: #af52de;
    --accent-frontend: #ff9500;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 24px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.4;
  }
  .container { max-width: 920px; margin: 0 auto; }
  .header {
    background: var(--card);
    border-radius: 14px;
    padding: 20px 24px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }
  .header h1 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
  .header .subtitle { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
  .chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .chip--ok { background: #e4f8eb; color: #1f7a3e; }
  .chip--warn { background: #fff4e0; color: #a36200; }
  .chip--error { background: #ffe4e1; color: #b0261e; }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-top: 14px;
  }
  .stat {
    text-align: center;
    padding: 10px;
    background: var(--bg);
    border-radius: 10px;
  }
  .stat__value { font-size: 18px; font-weight: 600; }
  .stat__label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .chat {
    background: var(--card);
    border-radius: 14px;
    padding: 18px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }
  .round-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 18px 0 12px;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .round-divider::before,
  .round-divider::after {
    content: "";
    flex: 1;
    border-top: 1px solid var(--border);
  }
  .msg { display: flex; margin: 6px 0; }
  .msg--user { justify-content: flex-end; }
  .msg--assistant { justify-content: flex-start; }
  .bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 18px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .bubble--user {
    background: var(--user);
    color: white;
    border-bottom-right-radius: 6px;
  }
  .bubble--assistant {
    background: var(--assistant);
    color: var(--text);
    border-bottom-left-radius: 6px;
  }
  .event {
    margin: 8px 0;
    padding: 10px 14px;
    background: #fafafa;
    border-left: 3px solid var(--border);
    border-radius: 6px;
  }
  .event--frontend { border-left-color: var(--accent-frontend); background: #fff8ec; }
  .event--backend { border-left-color: var(--accent-backend); background: #f7eefc; }
  .event--response { border-left-color: var(--user); background: #e7f1ff; }
  .event--error { border-left-color: var(--accent-err); background: #ffe4e1; color: #b0261e; }
  .event__head { display: flex; align-items: center; gap: 8px; }
  .event__icon { font-size: 14px; }
  .event__title { font-weight: 600; font-size: 13px; }
  .badge {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .badge--frontend { background: var(--accent-frontend); color: white; }
  .badge--backend { background: var(--accent-backend); color: white; }
  .event__details {
    margin-top: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .event__details summary { cursor: pointer; user-select: none; }
  .event__details pre {
    margin: 6px 0 0;
    padding: 8px 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text);
  }
`

export function renderChatHtml(result: RunResult): string {
  const { steps, rounds, stopReason, stopDetail, name } = result

  const toolCallCount = steps.filter((s) => s.type === 'tool_call').length
  const assistantCount = steps.filter((s) => s.type === 'assistant_text').length
  const userResponseCount = steps.filter(
    (s) => s.type === 'user_tool_response' || s.type === 'user_text',
  ).length
  const errorCount = steps.filter((s) => s.type === 'error').length

  // Group by round and emit a divider before each new round.
  let body = ''
  let currentRound = 0
  for (const step of steps) {
    if (step.round !== currentRound) {
      currentRound = step.round
      body += `<div class="round-divider"><span>Round ${currentRound}</span></div>`
    }
    body += renderStepHtml(step)
  }

  const tone = stopReasonTone(stopReason)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(name)}</title>
<style>${HTML_STYLES}</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="subtitle">${rounds} round(s) · ${steps.length} recorded step(s)</div>
    <span class="chip chip--${tone}">Stop: ${escapeHtml(stopReason)}${
      stopDetail ? ' — ' + escapeHtml(stopDetail) : ''
    }</span>
    <div class="stats">
      <div class="stat"><div class="stat__value">${toolCallCount}</div><div class="stat__label">Tool calls</div></div>
      <div class="stat"><div class="stat__value">${assistantCount}</div><div class="stat__label">Assistant msgs</div></div>
      <div class="stat"><div class="stat__value">${userResponseCount}</div><div class="stat__label">User responses</div></div>
      <div class="stat"><div class="stat__value">${errorCount}</div><div class="stat__label">Errors</div></div>
    </div>
  </div>
  <div class="chat">
    ${body || '<div class="event">No steps recorded.</div>'}
  </div>
</div>
</body>
</html>`
}

/**
 * Save a pretty chat-style HTML transcript of a scenario run into a
 * `results/` directory next to the calling test file.
 *
 * Usage:
 * ```ts
 * saveChatHtml(result, import.meta.url)
 * ```
 *
 * The file is named after the sanitized scenario name.
 */
export function saveChatHtml(result: RunResult, testFileUrl: string, customName?: string): string {
  const testDir = path.dirname(fileURLToPath(testFileUrl))
  const resultsDir = path.join(testDir, 'results')
  fs.mkdirSync(resultsDir, { recursive: true })

  const baseName = (customName ?? result.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const filePath = path.join(resultsDir, `${baseName || 'scenario'}.html`)

  fs.writeFileSync(filePath, renderChatHtml(result), 'utf8')
  console.log(`  HTML report: ${filePath}`)
  return filePath
}
