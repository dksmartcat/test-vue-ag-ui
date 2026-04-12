/**
 * Scenario-based integration test runner for AG-UI translation flows.
 *
 * A scenario is a flat ordered list of steps.
 * Each step is either required (default) or optional.
 * Steps can match tool calls OR text-only rounds from the agent.
 *
 * Text handling:
 *   - Text that arrives in a round WITH tool calls is informational
 *     (e.g. agent plan) — it is logged but skipped automatically.
 *   - Text that arrives in a round WITHOUT tool calls means the agent
 *     is asking the user a question — it must match a { text: true }
 *     step in the scenario. The reply is sent back to continue the flow.
 *
 * Matching logic — for every tool call event:
 *   1. Starting from the current cursor, skip optional steps that don't match.
 *   2. If a required or optional step matches — advance the cursor past it.
 *   3. If no match is found — the test fails ("unexpected event").
 *
 * At the end, any remaining unmatched required steps cause a failure.
 */
import { HttpAgent, randomUUID } from '@ag-ui/client'
import type { RunAgentInput, ToolCall } from '@ag-ui/client'
import * as path from 'node:path'
import { SERVER_URL, TOKEN } from './config'
import { uploadTestFiles, type FileInput } from './drive'
import { TOOL_DEFS, type ToolHandler } from './tools'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlowToolStep {
  tool: string
  handler?: ToolHandler
  resultContains?: string
  count?: number
  optional?: boolean
  /** Called after the tool call matches. Use to collect data or validate args/result. Throw to fail the test. */
  check?: (args: Record<string, unknown>, result: string | undefined) => void
}

export interface FlowTextStep {
  text: true
  /** If set, the text message must contain this substring */
  contains?: string
  /** Reply to send back (default: "ok") */
  reply?: string
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

export interface FlowScenario {
  name: string
  message: string
  files: FileInput[]
  steps: FlowEntry[]
  /** Handlers for frontend tools. Key = tool name, value = handler function. */
  handlers: Record<string, ToolHandler>
  /** Tool name patterns that are always allowed anywhere in the flow (prefix or regex) */
  optionalTools?: Array<string | RegExp>
  maxRounds?: number
}

export interface StepResult {
  tool: string
  round: number
  source: 'frontend' | 'backend' | 'text'
  resultSnippet?: string
}

export interface ScenarioResult {
  success: boolean
  completedSteps: StepResult[]
  allToolCalls: Array<{
    tool: string
    round: number
    source: 'frontend' | 'backend'
    resultContent?: string
  }>
  assistantMessages: string[]
  rounds: number
  error: string | null
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
    if (step.count && step.count > 1) label += ` ×${step.count}`
    if (step.optional) label += ' [optional]'
    return label
  }
  let label = step.tool
  if (step.resultContains) label += ` (contains "${step.resultContains}")`
  if (step.count && step.count > 1) label += ` ×${step.count}`
  if (step.optional) label += ' [optional]'
  return label
}

function entryLabel(entry: FlowEntry): string {
  if (isBlock(entry)) {
    const inner = entry.block.map(stepLabel).join(', ')
    return `[${inner}] ×${entry.count}`
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
// Runner
// ---------------------------------------------------------------------------

export async function runScenario(scenario: FlowScenario): Promise<ScenarioResult> {
  if (scenario.files.length === 0) {
    throw new Error(
      `Scenario "${scenario.name}" has no files. Add test files to the scenario's files/ directory.`,
    )
  }

  const maxRounds = scenario.maxRounds ?? 20
  const optPatterns = scenario.optionalTools ?? []

  const expanded = expandEntries(scenario.steps)

  // Print plan
  console.log(`\n=== Scenario: ${scenario.name} ===`)
  console.log(`  Files: ${scenario.files.map((f) => path.basename(f.path)).join(', ')}`)
  console.log(`  Message: "${scenario.message}"`)
  console.log(`  Steps:`)
  for (const entry of scenario.steps) {
    console.log(`    - ${entryLabel(entry)}`)
  }

  // 1. Upload files
  const driveFiles = await uploadTestFiles(scenario.files)

  // 2. Build initial messages
  const headers: Record<string, string> = {}
  if (TOKEN) headers['X-Token'] = TOKEN

  const agent = new HttpAgentWithHeaders({ url: SERVER_URL, headers })

  agent.addMessage({ id: randomUUID(), role: 'user', content: scenario.message })

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
  const completedSteps: StepResult[] = []
  const allToolCalls: ScenarioResult['allToolCalls'] = []
  const assistantMessages: string[] = []
  let currentError: string | null = null
  let round = 0
  let cursor = 0

  while (round++ < maxRounds) {
    console.log(`\n--- Round ${round} ---`)

    const pendingToolCalls: ToolCall[] = []
    const serverResolvedToolIds = new Set<string>()
    const toolResultContents = new Map<string, string>()
    const textMessages: string[] = []
    let currentMessageText = ''

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
          console.log(`  |${toolCall.id}| [TOOL_CALL] ${toolCall.function.name} args=${argsStr.slice(0, 200)}`)
          pendingToolCalls.push(toolCall)
        },
        onToolCallResultEvent({ event }) {
          const content = event.content ?? ''
          console.log(
            `  |${event.toolCallId}| [TOOL_RESULT] content=${content.slice(0, 100)}`,
          )
          serverResolvedToolIds.add(event.toolCallId)
          toolResultContents.set(event.toolCallId, content)
        },
        onRunFinishedEvent() {
          console.log(`  [RUN_FINISHED]`)
          subscription.unsubscribe()
          resolve(true)
        },
        onRunErrorEvent({ event }) {
          console.log(`  [RUN_ERROR] ${event.message}`)
          currentError = event.message
          subscription.unsubscribe()
          resolve(false)
        },
      })

      agent.runAgent({ tools: TOOL_DEFS }).catch((err: unknown) => {
        currentError = err instanceof Error ? err.message : String(err)
        subscription.unsubscribe()
        resolve(false)
      })
    })

    if (!runComplete || currentError) break

    const hasToolCalls = pendingToolCalls.length > 0
    const hasText = textMessages.length > 0
    const roundTextContent = textMessages.join('\n')

    // --- Track all tool calls ---
    for (const tc of pendingToolCalls) {
      const source: 'frontend' | 'backend' = serverResolvedToolIds.has(tc.id)
        ? 'backend'
        : 'frontend'
      allToolCalls.push({
        tool: tc.function.name,
        round,
        source,
        resultContent: toolResultContents.get(tc.id),
      })
    }

    // =================================================================
    // CASE 1: Round has tool calls (text alongside is informational)
    // =================================================================
    if (hasToolCalls) {
      if (hasText) {
        console.log(`  ⊘ text with tool calls (informational, skipped)`)
        assistantMessages.push(roundTextContent)
      }

      // Match tool calls against expected steps
      for (const tc of pendingToolCalls) {
        const name = tc.function.name
        const resultContent = toolResultContents.get(tc.id)
        const source: 'frontend' | 'backend' = serverResolvedToolIds.has(tc.id)
          ? 'backend'
          : 'frontend'

        if (cursor >= expanded.length) {
          if (isOptionalTool(name, optPatterns)) {
            console.log(`  ⊘ ${name} (scenario optional, after all steps)`)
            continue
          }
          currentError = `Unexpected tool call "${name}" after all expected steps completed`
          console.log(`  ✗ ${currentError}`)
          break
        }

        const result = tryMatchCursor(expanded, cursor, (step) =>
          matchesToolStep(step, name, resultContent),
        )

        if (result.matched) {
          for (let si = cursor; si < result.newCursor - 1; si++) {
            console.log(`  ⊘ ${stepLabel(expanded[si]!)} (skipped)`)
          }
          const matchedStep = expanded[result.newCursor - 1]!
          console.log(`  ✓ ${stepLabel(matchedStep)}`)

          // Run check callback if present
          if (isToolStep(matchedStep) && matchedStep.check) {
            try {
              const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
              matchedStep.check(args, resultContent)
              console.log(`  ✓ check passed`)
            } catch (err) {
              currentError = `Check failed for "${name}": ${err instanceof Error ? err.message : String(err)}`
              console.log(`  ✗ ${currentError}`)
              break
            }
          }

          completedSteps.push({
            tool: name,
            round,
            source,
            resultSnippet: resultContent?.slice(0, 120),
          })
          cursor = result.newCursor
          continue
        }

        // Not matched — check scenario-level optional
        if (isOptionalTool(name, optPatterns)) {
          console.log(`  ⊘ ${name} (scenario optional)`)
          continue
        }

        // Check any optional step in the list
        const isKnownOptional = expanded.some(
          (s) => s.optional && matchesToolStep(s, name, resultContent),
        )
        if (isKnownOptional) {
          console.log(`  ⊘ ${name} (optional, out of order)`)
          continue
        }

        const expected = expanded[cursor] ? stepLabel(expanded[cursor]!) : '(end)'
        currentError = `Unexpected tool call "${name}" at step ${cursor + 1}/${expanded.length} (expected: ${expected})`
        console.log(`  ✗ ${currentError}`)
        break
      }

      if (currentError) break

      // All steps matched?
      if (cursor >= expanded.length) {
        console.log(`\n=== All steps completed after round ${round}! ===`)
        return buildResult(true, completedSteps, allToolCalls, assistantMessages, round, null)
      }

      // Handle frontend tool responses
      const frontendToolCalls = pendingToolCalls.filter(
        (tc) => !serverResolvedToolIds.has(tc.id),
      )

      for (const tc of frontendToolCalls) {
        const name = tc.function.name
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>

        const stepOverride = expanded.find(
          (e): e is FlowToolStep => isToolStep(e) && e.tool === name && !!e.handler,
        )
        const handler = stepOverride?.handler ?? scenario.handlers[name]

        const result = handler
          ? handler(args)
          : JSON.stringify({ error: `No handler for ${name}` })
        console.log(`  → ${name}: ${result.slice(0, 80)}`)

        agent.addMessage({
          id: randomUUID(),
          role: 'tool',
          toolCallId: tc.id,
          content: result,
        })
      }

      continue
    }

    // =================================================================
    // CASE 2: Text-only round — agent is asking the user a question
    // =================================================================
    if (hasText) {
      assistantMessages.push(roundTextContent)

      // Try to match against a text step
      const result = tryMatchCursor(expanded, cursor, (step) =>
        matchesTextStep(step, roundTextContent),
      )

      if (result.matched) {
        for (let si = cursor; si < result.newCursor - 1; si++) {
          console.log(`  ⊘ ${stepLabel(expanded[si]!)} (skipped)`)
        }
        const matchedStep = expanded[result.newCursor - 1]! as FlowTextStep
        console.log(`  ✓ ${stepLabel(matchedStep)}`)
        completedSteps.push({
          tool: '[text]',
          round,
          source: 'text',
          resultSnippet: roundTextContent.slice(0, 120),
        })
        cursor = result.newCursor

        const reply = matchedStep.reply ?? 'ok'
        console.log(`  Replying with "${reply}"`)
        agent.addMessage({ id: randomUUID(), role: 'user', content: reply })
        continue
      }

      // No text step matched — check if any optional text step exists
      const isKnownOptional = expanded.some(
        (s) => s.optional && matchesTextStep(s, roundTextContent),
      )
      if (isKnownOptional) {
        console.log(`  ⊘ text (optional, out of order)`)
        agent.addMessage({ id: randomUUID(), role: 'user', content: 'ok' })
        continue
      }

      // Next expected step is a tool step — treat this text as informational, continue
      const nextStep = cursor < expanded.length ? expanded[cursor] : undefined
      if (nextStep && isToolStep(nextStep)) {
        console.log(`  ⊘ text (informational, next expected step is tool "${nextStep.tool}")`)
        continue
      }

      // Unexpected text-only round
      const expected = cursor < expanded.length ? stepLabel(expanded[cursor]!) : '(end)'
      currentError = `Unexpected text-only round at step ${cursor + 1}/${expanded.length} (expected: ${expected}). Text: "${roundTextContent.slice(0, 100)}"`
      console.log(`  ✗ ${currentError}`)
      break
    }

    // =================================================================
    // CASE 3: No tool calls and no text — flow ended
    // =================================================================
    console.log(`  No tool calls and no text — flow ended.`)
    break
  }

  // Check for remaining required steps
  if (!currentError) {
    const remaining = expanded
      .slice(cursor)
      .filter((s) => !s.optional)
    if (remaining.length > 0) {
      currentError = `Flow ended with ${remaining.length} required step(s) remaining: ${remaining.map(stepLabel).join(', ')}`
    }
  }

  return buildResult(false, completedSteps, allToolCalls, assistantMessages, round - 1, currentError)
}

function buildResult(
  success: boolean,
  completedSteps: StepResult[],
  allToolCalls: ScenarioResult['allToolCalls'],
  assistantMessages: string[],
  rounds: number,
  error: string | null,
): ScenarioResult {
  console.log(`\n=== Result: ${success ? 'PASS' : 'FAIL'} ===`)
  console.log(`  Completed steps: ${completedSteps.map((s) => `R${s.round}:${s.tool}`).join(', ')}`)
  console.log(`  Total tool calls: ${allToolCalls.length}`)
  console.log(`  Rounds: ${rounds}`)
  if (error) console.log(`  Error: ${error}`)
  return { success, completedSteps, allToolCalls, assistantMessages, rounds, error }
}
