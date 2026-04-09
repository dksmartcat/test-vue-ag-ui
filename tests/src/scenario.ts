/**
 * Scenario-based integration test runner for AG-UI translation flows.
 *
 * A scenario is a flat ordered list of steps.
 * Each step is either required (default) or optional.
 *
 * Matching logic — for every real tool call received from the agent:
 *   1. Starting from the current cursor, skip optional steps that don't match.
 *   2. If a required or optional step matches — advance the cursor past it.
 *   3. If no match is found — the test fails ("unknown step").
 *
 * At the end, any remaining unmatched required steps also cause a failure.
 */
import { HttpAgent, randomUUID } from '@ag-ui/client'
import type { RunAgentInput, ToolCall } from '@ag-ui/client'
import * as path from 'node:path'
import { SERVER_URL, TOKEN } from './config'
import { uploadTestFiles, type FileInput } from './drive'
import { TOOL_DEFS, TOOL_HANDLERS, type ToolHandler } from './tools'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlowStep {
  tool: string
  handler?: ToolHandler
  resultContains?: string
  count?: number
  optional?: boolean
}

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
  /** Tool name patterns that are always allowed anywhere in the flow (prefix or regex) */
  optionalTools?: Array<string | RegExp>
  maxRounds?: number
}

export interface StepResult {
  tool: string
  round: number
  source: 'frontend' | 'backend'
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

function stepLabel(step: FlowStep): string {
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

/** Try to match a tool call against a specific step, respecting resultContains. */
function matchesStep(
  step: FlowStep,
  toolName: string,
  resultContent: string | undefined,
): boolean {
  if (toolName !== step.tool) return false
  if (
    step.resultContains &&
    (!resultContent || !resultContent.includes(step.resultContains))
  )
    return false
  return true
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
    let roundText = ''
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
            roundText += currentMessageText
          }
          currentMessageText = ''
        },
        onNewToolCall({ toolCall }) {
          console.log(`  |${toolCall.id}| [TOOL_CALL] ${toolCall.function.name}`)
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

    // --- Match tool calls against expected steps ---
    for (const tc of pendingToolCalls) {
      const name = tc.function.name
      const resultContent = toolResultContents.get(tc.id)
      const source: 'frontend' | 'backend' = serverResolvedToolIds.has(tc.id)
        ? 'backend'
        : 'frontend'

      if (cursor >= expanded.length) {
        if (!isOptionalTool(name, optPatterns)) {
          currentError = `Unexpected tool call "${name}" after all expected steps completed`
          console.log(`  ✗ ${currentError}`)
          break
        }
        console.log(`  ⊘ ${name} (scenario optional, after all steps)`)
        continue
      }

      // Try to find a matching step starting from cursor
      let matched = false
      let searchIdx = cursor

      while (searchIdx < expanded.length) {
        const candidate = expanded[searchIdx]!
        if (matchesStep(candidate, name, resultContent)) {
          // All steps between cursor and searchIdx must be optional (they're being skipped)
          let canSkip = true
          for (let si = cursor; si < searchIdx; si++) {
            if (!expanded[si]!.optional) {
              canSkip = false
              break
            }
          }

          if (!canSkip) {
            // Can't skip a required step to reach this match
            break
          }

          // Log skipped optional steps
          for (let si = cursor; si < searchIdx; si++) {
            console.log(`  ⊘ ${stepLabel(expanded[si]!)} (skipped)`)
          }

          cursor = searchIdx + 1
          matched = true
          console.log(`  ✓ ${stepLabel(candidate)}`)
          completedSteps.push({
            tool: name,
            round,
            source,
            resultSnippet: resultContent?.slice(0, 120),
          })
          break
        }

        // If current candidate is optional, we can skip past it to look further
        if (expanded[searchIdx]!.optional) {
          searchIdx++
          continue
        }

        // Hit a required step that doesn't match — stop searching
        break
      }

      if (!matched) {
        // Check scenario-level optional tools (e.g. handoff_to_*)
        if (isOptionalTool(name, optPatterns)) {
          console.log(`  ⊘ ${name} (scenario optional)`)
          continue
        }

        // Check if this tool call matches ANY optional step in the entire list
        const isKnownOptional = expanded.some(
          (s) => s.optional && matchesStep(s, name, resultContent),
        )
        if (isKnownOptional) {
          console.log(`  ⊘ ${name} (optional, out of order)`)
          continue
        }

        currentError = `Unexpected tool call "${name}" at step ${cursor + 1}/${expanded.length} (expected: ${stepLabel(expanded[cursor] ?? expanded[expanded.length - 1]!)})`
        console.log(`  ✗ ${currentError}`)
        break
      }
    }

    if (currentError) break

    // All steps matched?
    if (cursor >= expanded.length) {
      console.log(`\n=== All steps completed after round ${round}! ===`)
      return buildResult(true, completedSteps, allToolCalls, assistantMessages, round, null)
    }

    // --- Handle frontend tool calls ---
    const frontendToolCalls = pendingToolCalls.filter(
      (tc) => !serverResolvedToolIds.has(tc.id),
    )

    if (frontendToolCalls.length === 0) {
      if (roundText.trim()) {
        console.log(`  Assistant: "${roundText.trim().slice(0, 120)}..."`)
        console.log(`  Replying with "default"`)
        assistantMessages.push(roundText.trim())
        agent.addMessage({ id: randomUUID(), role: 'user', content: 'default' })
        continue
      }
      console.log(`  No frontend tool calls and no text — flow ended.`)
      break
    }

    for (const tc of frontendToolCalls) {
      const name = tc.function.name
      const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>

      const stepOverride = expanded.find((e) => e.tool === name && e.handler)
      const handler = stepOverride?.handler ?? TOOL_HANDLERS[name]

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
