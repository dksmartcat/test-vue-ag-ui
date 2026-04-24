/**
 * Shared session plumbing for both runners:
 *   - creating the configured AG-UI HTTP agent,
 *   - uploading scenario files and seeding initial messages,
 *   - executing one agent round and collecting its events.
 */
import { HttpAgent, randomUUID } from '@ag-ui/client'
import type { RunAgentInput, ToolCall } from '@ag-ui/client'
import { SERVER_URL, TOKEN } from '../config'
import { uploadTestFiles, type FileInput } from '../drive'
import { TOOL_DEFS } from '../tools'

class HttpAgentWithHeaders extends HttpAgent {
  protected requestInit(input: RunAgentInput): RequestInit {
    return super.requestInit(input)
  }
}

export async function createAgentForScenario(
  message: string,
  files: FileInput[],
): Promise<HttpAgent> {
  const driveFiles = await uploadTestFiles(files)

  const headers: Record<string, string> = {}
  if (TOKEN) headers['X-Token'] = TOKEN

  const agent = new HttpAgentWithHeaders({ url: SERVER_URL, headers })
  agent.addMessage({ id: randomUUID(), role: 'user', content: message })

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

  return agent
}

export interface RoundData {
  /** true if the SSE stream finished normally (RunFinished event). */
  ok: boolean
  pendingToolCalls: ToolCall[]
  serverResolvedToolIds: Set<string>
  toolResultContents: Map<string, string>
  textMessages: string[]
}

export async function runAgentRound(agent: HttpAgent): Promise<RoundData> {
  const pendingToolCalls: ToolCall[] = []
  const serverResolvedToolIds = new Set<string>()
  const toolResultContents = new Map<string, string>()
  const textMessages: string[] = []
  let currentMessageText = ''
  let hasError = false

  const ok = await new Promise<boolean>((resolve) => {
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
        console.log(
          `  |${toolCall.id}| [TOOL_CALL] ${toolCall.function.name} args=${argsStr.slice(0, 300)}`,
        )
        pendingToolCalls.push(toolCall)
      },
      onToolCallResultEvent({ event }) {
        const content = event.content ?? ''
        console.log(`  |${event.toolCallId}| [TOOL_RESULT] content=${content.slice(0, 200)}`)
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

  return {
    ok: ok && !hasError,
    pendingToolCalls,
    serverResolvedToolIds,
    toolResultContents,
    textMessages,
  }
}
