/**
 * Free-form scenario runner — no step validation, just full logging.
 * Runs the agent flow end-to-end and prints every event for manual analysis.
 */
import { HttpAgent, randomUUID } from '@ag-ui/client'
import type { RunAgentInput, ToolCall } from '@ag-ui/client'
import * as path from 'node:path'
import { SERVER_URL, TOKEN } from './config'
import { uploadTestFiles, type FileInput } from './drive'
import { TOOL_DEFS, type ToolHandler } from './tools'
import type { FlowScenario, FlowToolStep } from './scenario'

class HttpAgentWithHeaders extends HttpAgent {
  protected requestInit(input: RunAgentInput): RequestInit {
    return super.requestInit(input)
  }
}

function isToolStep(step: unknown): step is FlowToolStep {
  return typeof step === 'object' && step !== null && 'tool' in step
}

function collectHandlerOverrides(scenario: FlowScenario): Map<string, ToolHandler> {
  const overrides = new Map<string, ToolHandler>()
  for (const entry of scenario.steps) {
    if (isToolStep(entry) && entry.handler) {
      overrides.set(entry.tool, entry.handler)
    }
    if ('block' in entry && Array.isArray((entry as { block: unknown[] }).block)) {
      for (const s of (entry as { block: FlowToolStep[] }).block) {
        if (isToolStep(s) && s.handler) {
          overrides.set(s.tool, s.handler)
        }
      }
    }
  }
  return overrides
}

export interface TraceResult {
  rounds: number
  toolCalls: Array<{
    tool: string
    round: number
    source: 'frontend' | 'backend'
    args: string
    result?: string
  }>
  textMessages: string[]
}

export async function traceScenario(
  scenario: FlowScenario,
  maxRounds = 30,
  maxConsecutiveEmpty = 3,
): Promise<TraceResult> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TRACE: ${scenario.name}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Files: ${scenario.files.map((f) => path.basename(f.path)).join(', ')}`)
  console.log(`  Message: "${scenario.message}"`)
  console.log(`  Max rounds: ${maxRounds}, max consecutive empty: ${maxConsecutiveEmpty}`)

  if (scenario.files.length === 0) {
    throw new Error(`Scenario "${scenario.name}" has no files.`)
  }

  const driveFiles = await uploadTestFiles(scenario.files)

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

  const handlerOverrides = collectHandlerOverrides(scenario)
  const allToolCalls: TraceResult['toolCalls'] = []
  const textMessages: string[] = []
  let round = 0
  let consecutiveEmpty = 0

  while (round++ < maxRounds) {
    console.log(`\n--- Round ${round} ---`)

    const pendingToolCalls: ToolCall[] = []
    const serverResolvedToolIds = new Set<string>()
    const toolResultContents = new Map<string, string>()
    const roundTexts: string[] = []
    let currentMessageText = ''
    let hasError = false

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
            roundTexts.push(currentMessageText.trim())
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
          console.log(`  |${event.toolCallId}| [TOOL_RESULT] content=${content.slice(0, 200)}`)
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

    if (!runComplete || hasError) {
      console.log(`  Flow stopped (error or incomplete).`)
      break
    }

    textMessages.push(...roundTexts)

    for (const tc of pendingToolCalls) {
      const source: 'frontend' | 'backend' = serverResolvedToolIds.has(tc.id)
        ? 'backend'
        : 'frontend'
      allToolCalls.push({
        tool: tc.function.name,
        round,
        source,
        args: tc.function.arguments || '{}',
        result: toolResultContents.get(tc.id),
      })
    }

    if (pendingToolCalls.length === 0 && roundTexts.length === 0) {
      consecutiveEmpty++
      console.log(`  (empty round ${consecutiveEmpty}/${maxConsecutiveEmpty})`)
      if (consecutiveEmpty >= maxConsecutiveEmpty) {
        console.log(`  Stopping after ${maxConsecutiveEmpty} consecutive empty rounds.`)
        break
      }
      continue
    }

    consecutiveEmpty = 0

    const frontendToolCalls = pendingToolCalls.filter(
      (tc) => !serverResolvedToolIds.has(tc.id),
    )

    for (const tc of frontendToolCalls) {
      const name = tc.function.name
      const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>

      const handler =
        handlerOverrides.get(name) ?? scenario.handlers[name]

      const result = handler
        ? handler(args)
        : JSON.stringify({ error: `No handler for ${name}` })
      console.log(`  → ${name}: ${result.slice(0, 120)}`)

      agent.addMessage({
        id: randomUUID(),
        role: 'tool',
        toolCallId: tc.id,
        content: result,
      })
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`TRACE COMPLETE: ${scenario.name}`)
  console.log(`  Rounds: ${round - 1}`)
  console.log(`  Tool calls: ${allToolCalls.length}`)
  console.log(`  Text messages: ${textMessages.length}`)
  console.log(`  Tools: ${allToolCalls.map((tc) => `R${tc.round}:${tc.tool}(${tc.source})`).join(', ')}`)
  console.log(`${'='.repeat(60)}`)

  return { rounds: round - 1, toolCalls: allToolCalls, textMessages }
}
