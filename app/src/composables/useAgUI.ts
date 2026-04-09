import { ref, readonly, type Ref, watch } from 'vue'
import { HttpAgent, randomUUID } from '@ag-ui/client'
import type { Message, AgentSubscriber, RunAgentInput } from '@ag-ui/client'

class HttpAgentWithHeaders extends HttpAgent {
  protected requestInit(input: RunAgentInput): RequestInit {
    return super.requestInit(input)
  }
}

export interface ToolCallInfo {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  isRunning: boolean
}

export interface FrontendToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface UseAgUIOptions {
  url: Ref<string>
  token?: Ref<string>
  frontendTools?: FrontendToolDef[]
}

export interface SystemEvent {
  id: string
  type: 'run' | 'handoff' | 'tool_call' | 'tool_result' | 'text' | 'state' | 'error' | 'info'
  summary: string
  detail?: string
}

export type TimelineEntry =
  | { kind: 'message'; message: Message }
  | { kind: 'event'; event: SystemEvent }

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (token) {
    headers['X-Token'] = token;
  }
  return headers
}

function createAgent(url: string, token: string | undefined, subscriber: AgentSubscriber) {
  const agent = new HttpAgentWithHeaders({ url, headers: buildHeaders(token) })
  agent.subscribe(subscriber)
  return agent
}

let eventSeq = 0

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function extractHandoffTarget(toolName: string): string | null {
  const match = toolName.match(/^transfer_?[Tt]o_?(.+)$/i)
  return match ? match[1] : null
}

export function useAgUI(options: UseAgUIOptions) {
  const { url, token, frontendTools = [] } = options

  let agent = new HttpAgentWithHeaders({ url: url.value, headers: buildHeaders(token?.value) })

  const messages = ref<Message[]>([])
  const streamingText = ref('')
  const isRunning = ref(false)
  const error = ref<string | null>(null)
  const toolCalls = ref<Map<string, ToolCallInfo>>(new Map())
  const timeline = ref<TimelineEntry[]>([])

  function pushEvent(type: SystemEvent['type'], summary: string, detail?: string) {
    timeline.value = [...timeline.value, {
      kind: 'event',
      event: { id: `evt-${++eventSeq}`, type, summary, detail },
    }]
  }

  function pushMessage(msg: Message) {
    timeline.value = [...timeline.value, { kind: 'message', message: msg }]
  }

  const toolCallNames = new Map<string, string>()

  const subscriber: AgentSubscriber = {
    onTextMessageStartEvent() {
      pushEvent('text', 'Assistant responding…')
      streamingText.value = ''
    },
    onTextMessageContentEvent({ event }) {
      streamingText.value += event.delta
    },
    onTextMessageEndEvent({ event }) {
      const msg: Message = {
        id: event.messageId,
        role: 'assistant',
        content: streamingText.value,
      }
      messages.value = [...messages.value, msg]
      pushMessage(msg)
      streamingText.value = ''
    },
    onToolCallStartEvent({ event }) {
      toolCallNames.set(event.toolCallId, event.toolCallName)

      const target = extractHandoffTarget(event.toolCallName)
      if (target) {
        pushEvent('handoff', `Handoff → ${target}`)
      } else {
        pushEvent('tool_call', `Calling ${event.toolCallName}`)
      }

      toolCalls.value = new Map(toolCalls.value)
      toolCalls.value.set(event.toolCallId, {
        id: event.toolCallId,
        name: event.toolCallName,
        args: {},
        isRunning: true,
      })
    },
    onToolCallArgsEvent() {},
    onToolCallEndEvent({ event, toolCallArgs }) {
      const tc = toolCalls.value.get(event.toolCallId)
      if (tc) {
        toolCalls.value = new Map(toolCalls.value)
        toolCalls.value.set(event.toolCallId, { ...tc, args: toolCallArgs })
      }

      const name = toolCallNames.get(event.toolCallId) ?? 'unknown'
      if (!extractHandoffTarget(name) && toolCallArgs && Object.keys(toolCallArgs).length > 0) {
        pushEvent('tool_call', `${name} args`, formatJson(JSON.stringify(toolCallArgs)))
      }
    },
    onToolCallResultEvent({ event }) {
      const tc = toolCalls.value.get(event.toolCallId)
      if (tc) {
        toolCalls.value = new Map(toolCalls.value)
        toolCalls.value.set(event.toolCallId, {
          ...tc,
          result: event.content,
          isRunning: false,
        })
      }

      const name = toolCallNames.get(event.toolCallId) ?? 'unknown'
      if (!extractHandoffTarget(name)) {
        pushEvent('tool_result', `Result: ${name}`, event.content ? formatJson(event.content) : undefined)
      }
    },
    onRunStartedEvent({ event }) {
      pushEvent('run', 'Run started', `Thread: ${event.threadId}\nRun: ${event.runId}`)
    },
    onRunFinishedEvent() {
      pushEvent('run', 'Run finished')
    },
    onRunErrorEvent({ event }) {
      pushEvent('error', `Error: ${event.message}`)
      error.value = event.message
      isRunning.value = false
    },
    onCustomEvent({ event }) {
      pushEvent('info', 'Custom event', JSON.stringify(event, null, 2))
    },
    onStateSnapshotEvent({ event }) {
      pushEvent('state', 'State snapshot', JSON.stringify(event.snapshot, null, 2))
    },
    onStateDeltaEvent({ event }) {
      pushEvent('state', 'State delta', JSON.stringify(event.delta, null, 2))
    },
    onMessagesSnapshotEvent({ event }) {
      pushEvent('info', `Messages snapshot (${event.messages?.length ?? 0} msgs)`)
    },
    onRawEvent({ event }) {
      const handled = new Set([
        'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END',
        'TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END', 'TOOL_CALL_RESULT',
        'RUN_STARTED', 'RUN_FINISHED', 'RUN_ERROR',
        'STATE_SNAPSHOT', 'STATE_DELTA', 'MESSAGES_SNAPSHOT', 'CUSTOM',
      ])
      if (!handled.has(event.type)) {
        pushEvent('info', `Event: ${event.type}`, JSON.stringify(event, null, 2))
      }
    },
  }

  agent.subscribe(subscriber)

  const watchSources = token ? [url, token] : [url]
  watch(watchSources, () => {
    agent = createAgent(url.value, token?.value, subscriber)
  })

  async function sendMessage(content: string) {
    if (!content.trim() || isRunning.value) return

    error.value = null
    isRunning.value = true
    toolCalls.value = new Map()

    const userMessage: Message = {
      id: randomUUID(),
      role: 'user',
      content: content.trim(),
    }
    messages.value = [...messages.value, userMessage]
    pushMessage(userMessage)
    agent.addMessage(userMessage)

    try {
      await agent.runAgent({ tools: frontendTools })
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isRunning.value = false
    }
  }

  function abort() {
    agent.abortRun()
    isRunning.value = false
  }

  return {
    messages: readonly(messages),
    streamingText: readonly(streamingText),
    isRunning: readonly(isRunning),
    error: readonly(error),
    toolCalls: readonly(toolCalls),
    timeline: readonly(timeline),
    sendMessage,
    abort,
  }
}
