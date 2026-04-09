/**
 * Scenario-based integration test runner for AG-UI translation flows.
 *
 * A scenario is a declarative description of a test:
 *   - user message + files to upload
 *   - steps grouped by round number — each step must complete in its round
 *
 * After each AG-UI round the runner validates that every expected step
 * for that round was observed. If any step is missing the test fails
 * immediately. Once the last expected round passes, the test succeeds.
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
  /** Tool name to match */
  tool: string
  /** Override handler for a frontend tool in this step */
  handler?: ToolHandler
  /** Backend tool result must contain this substring */
  resultContains?: string
  /** How many times this tool must appear in the round (default 1) */
  count?: number
}

export interface RoundDef {
  round: number
  steps: FlowStep[]
}

/** Internal flat step with resolved round number */
interface ResolvedStep extends FlowStep {
  round: number
}

export interface FlowScenario {
  name: string
  message: string
  files: FileInput[]
  rounds: RoundDef[]
  maxRounds?: number
  timeout?: number
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

function stepLabel(step: FlowStep): string {
  const base = step.resultContains
    ? `${step.tool} (contains "${step.resultContains}")`
    : step.tool
  return step.count && step.count > 1 ? `${base} ×${step.count}` : base
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

  // Build lookup: round number → steps
  const stepsByRound = new Map<number, FlowStep[]>()
  for (const rd of scenario.rounds) {
    stepsByRound.set(rd.round, rd.steps)
  }
  const lastExpectedRound = Math.max(...scenario.rounds.map((r) => r.round))

  // Print plan
  console.log(`\n=== Scenario: ${scenario.name} ===`)
  console.log(`  Files: ${scenario.files.map((f) => path.basename(f.path)).join(', ')}`)
  console.log(`  Message: "${scenario.message}"`)
  for (const rd of scenario.rounds) {
    console.log(`  Round ${rd.round}: ${rd.steps.map(stepLabel).join(', ')}`)
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
        onRunStartedEvent({ event }) {
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

    // --- Match this round's expected steps ---
    const expectations = stepsByRound.get(round)
    if (expectations) {
      const matchCounts = new Array<number>(expectations.length).fill(0)

      for (const tc of pendingToolCalls) {
        const name = tc.function.name
        const resultContent = toolResultContents.get(tc.id)
        const source: 'frontend' | 'backend' = serverResolvedToolIds.has(tc.id)
          ? 'backend'
          : 'frontend'

        for (let ei = 0; ei < expectations.length; ei++) {
          const exp = expectations[ei]!
          const needed = exp.count ?? 1
          if (matchCounts[ei]! >= needed) continue
          if (name !== exp.tool) continue
          if (
            exp.resultContains &&
            (!resultContent || !resultContent.includes(exp.resultContains))
          )
            continue

          matchCounts[ei]!++
          completedSteps.push({
            tool: name,
            round,
            source,
            resultSnippet: resultContent?.slice(0, 120),
          })

          if (matchCounts[ei]! < needed) {
            console.log(`  ✓ ${name} [${matchCounts[ei]}/${needed}]`)
          } else {
            console.log(`  ✓ ${stepLabel(exp)}`)
          }
          break
        }
      }

      // Validate: every expectation fulfilled?
      const unfulfilled: string[] = []
      for (let ei = 0; ei < expectations.length; ei++) {
        const exp = expectations[ei]!
        const needed = exp.count ?? 1
        if (matchCounts[ei]! < needed) {
          unfulfilled.push(
            needed > 1
              ? `${stepLabel(exp)} (got ${matchCounts[ei]}/${needed})`
              : stepLabel(exp),
          )
        }
      }

      if (unfulfilled.length > 0) {
        currentError = `Round ${round}: expected steps not completed: ${unfulfilled.join(', ')}`
        console.log(`  ✗ ${currentError}`)
        break
      }
    }

    // All expected rounds done?
    if (round >= lastExpectedRound) {
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

      // Find handler override from this round's matched steps
      const stepOverride = expectations?.find((e) => e.tool === name && e.handler)
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

  if (!currentError) {
    const missingRounds: string[] = []
    for (let r = 1; r <= lastExpectedRound; r++) {
      const exps = stepsByRound.get(r)
      if (!exps) continue
      if (round <= r) {
        missingRounds.push(`round ${r}: ${exps.map(stepLabel).join(', ')}`)
      }
    }
    if (missingRounds.length > 0) {
      currentError = `Flow ended before reaching expected rounds: ${missingRounds.join('; ')}`
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
