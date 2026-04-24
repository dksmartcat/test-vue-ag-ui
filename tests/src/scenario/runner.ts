/**
 * Classic scenario runner — deterministic handlers + fixed text reply.
 *
 * See `ai-runner.ts` for the LLM-driven variant.
 */
import { randomUUID } from '@ag-ui/client'
import * as path from 'node:path'
import { createAgentForScenario, runAgentRound } from './session'
import type { ClassicUserConfig, RecordedStep, RunResult, StopReason } from './types'

export async function runScenario(config: ClassicUserConfig): Promise<RunResult> {
  if (config.files.length === 0) {
    throw new Error(
      `Scenario "${config.name}" has no files. Add test files to the scenario's files/ directory.`,
    )
  }

  const maxRounds = config.maxRounds ?? 20
  const maxTextMessages = config.maxTextMessages ?? 5
  const textReply = config.textReply ?? 'ok'
  const handlers = config.handlers

  const steps: RecordedStep[] = []
  let textMessageCount = 0
  let stopReason: StopReason = 'max_rounds'
  let stopDetail: string | undefined

  console.log(`\n=== Scenario: ${config.name} ===`)
  console.log(`  Files: ${config.files.map((f) => path.basename(f.path)).join(', ')}`)
  console.log(`  Message: "${config.message}"`)
  console.log(`  Handlers: ${Object.keys(handlers).join(', ')}`)
  console.log(`  Max rounds: ${maxRounds}, max text messages: ${maxTextMessages}`)

  const agent = await createAgentForScenario(config.message, config.files)

  let round = 0
  while (round < maxRounds) {
    round++
    console.log(`\n--- Round ${round} ---`)

    const roundData = await runAgentRound(agent)

    // Record assistant text
    for (const text of roundData.textMessages) {
      steps.push({ type: 'assistant_text', round, text })
    }

    if (!roundData.ok) {
      steps.push({ type: 'error', round, message: 'Run error or exception' })
      stopReason = 'run_error'
      stopDetail = 'Run error or exception from the agent stream'
      break
    }

    // Record tool calls + check stopOnToolCall
    let shouldStop = false
    for (const tc of roundData.pendingToolCalls) {
      const source: 'frontend' | 'backend' = roundData.serverResolvedToolIds.has(tc.id)
        ? 'backend'
        : 'frontend'
      steps.push({
        type: 'tool_call',
        round,
        tool: tc.function.name,
        toolCallId: tc.id,
        source,
        args: tc.function.arguments || '{}',
        result: roundData.toolResultContents.get(tc.id),
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

    const hasText = roundData.textMessages.length > 0
    const frontendToolCalls = roundData.pendingToolCalls.filter(
      (tc) => !roundData.serverResolvedToolIds.has(tc.id),
    )
    const hasFrontendToolCalls = frontendToolCalls.length > 0
    const hasToolCalls = roundData.pendingToolCalls.length > 0

    // =================================================================
    // CASE 1: Frontend tool calls — respond via handler
    // =================================================================
    if (hasFrontendToolCalls) {
      if (hasText) {
        console.log(`  (text alongside frontend tool calls — informational)`)
      }

      let missingHandler: string | null = null
      for (const tc of frontendToolCalls) {
        const name = tc.function.name
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
        const handler = handlers[name]

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
    // CASE 2: Text only (possibly with backend handoffs) — send textReply
    // =================================================================
    if (hasText) {
      if (hasToolCalls) {
        console.log(`  (backend tool calls alongside text — treating as text round)`)
      }

      if (textMessageCount >= maxTextMessages) {
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

      textMessageCount++
      console.log(`  -> User reply: "${textReply}" (${textMessageCount}/${maxTextMessages})`)
      steps.push({ type: 'user_text', round, text: textReply })
      agent.addMessage({ id: randomUUID(), role: 'user', content: textReply })

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

  if (stopReason === 'max_rounds' && round >= maxRounds) {
    stopDetail = `Max rounds (${maxRounds}) reached`
  }

  console.log(`\n=== Run complete: ${round} rounds, ${steps.length} recorded steps ===`)
  console.log(`  Stop reason: ${stopReason}${stopDetail ? ` — ${stopDetail}` : ''}`)
  return { steps, rounds: round, stopReason, stopDetail, name: config.name }
}
