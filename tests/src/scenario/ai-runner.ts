/**
 * AI scenario runner — self-contained LLM-driven user.
 *
 * The AI reads the scenario text (which includes exit conditions), watches the
 * conversation, and decides per-round what to do: respond to a tool call,
 * reply with text, or stop with a verdict (pass/fail). There are no step
 * expectations — the AI is the sole authority on whether the run passed.
 */
import { randomUUID } from '@ag-ui/client'
import * as path from 'node:path'
import { askAiUser, type AiUserContext } from './ai-user'
import { createAgentForScenario, runAgentRound } from './session'
import type {
  AiRunResult,
  AiUserConfig,
  AiVerdict,
  RecordedStep,
  StopReason,
} from './types'

export async function runAiScenario(config: AiUserConfig): Promise<AiRunResult> {
  if (config.files.length === 0) {
    throw new Error(
      `Scenario "${config.name}" has no files. Add test files to the scenario's files/ directory.`,
    )
  }

  const maxRounds = config.maxRounds ?? 20
  const maxTextMessages = config.maxTextMessages ?? 5

  const steps: RecordedStep[] = []
  let textMessageCount = 0
  let stopReason: StopReason = 'max_rounds'
  let stopDetail: string | undefined
  let verdict: AiVerdict | undefined
  let verdictReason: string | undefined

  /**
   * Loop guard: count how many times the same frontend tool was invoked
   * back-to-back without a user response that changed the state enough to
   * move the agent to a different tool. If the same tool fires 3 times in
   * a row we abort with fail — the AI's previous response clearly didn't
   * give the agent what it needed.
   */
  const MAX_SAME_TOOL_REPEATS = 3
  let lastFrontendTool: string | null = null
  let sameToolRepeats = 0

  console.log(`\n=== Scenario: ${config.name} (AI user) ===`)
  console.log(`  Files: ${config.files.map((f) => path.basename(f.path)).join(', ')}`)
  console.log(`  Message: "${config.message}"`)
  console.log(`  Scenario: ${config.scenario.slice(0, 120)}…`)
  console.log(`  Max rounds: ${maxRounds}, max text messages: ${maxTextMessages}`)

  const agent = await createAgentForScenario(config.message, config.files)

  let round = 0
  outer: while (round < maxRounds) {
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

    // Record tool calls (no stopOnToolCall here — AI itself stops when needed).
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
    }

    const hasText = roundData.textMessages.length > 0
    const frontendToolCalls = roundData.pendingToolCalls.filter(
      (tc) => !roundData.serverResolvedToolIds.has(tc.id),
    )
    const hasFrontendToolCalls = frontendToolCalls.length > 0
    const hasToolCalls = roundData.pendingToolCalls.length > 0

    // =================================================================
    // CASE 1: Frontend tool calls — ask AI for a tool response
    // =================================================================
    if (hasFrontendToolCalls) {
      if (hasText) {
        console.log(`  (text alongside frontend tool calls — informational)`)
      }

      // Detect a "stuck" loop where the agent keeps re-invoking the same
      // frontend tool because the AI's previous response wasn't actionable.
      const firstToolName = frontendToolCalls[0]!.function.name
      if (firstToolName === lastFrontendTool) {
        sameToolRepeats++
      } else {
        lastFrontendTool = firstToolName
        sameToolRepeats = 1
      }
      if (sameToolRepeats >= MAX_SAME_TOOL_REPEATS) {
        const msg = `Agent invoked "${firstToolName}" ${sameToolRepeats} rounds in a row — previous AI responses were not actionable.`
        console.log(`  [AI LOOP GUARD] ${msg}`)
        steps.push({ type: 'ai_stop', round, verdict: 'fail', reason: msg })
        stopReason = 'ai_user_stop'
        stopDetail = msg
        verdict = 'fail'
        verdictReason = msg
        break
      }

      for (const tc of frontendToolCalls) {
        const name = tc.function.name
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>

        let decision
        try {
          decision = await askAiUser(
            config,
            { kind: 'tool', toolName: name, toolArgs: args } satisfies AiUserContext,
            steps,
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.log(`  [AI ERROR] ${msg}`)
          steps.push({ type: 'error', round, message: `AI user error: ${msg}` })
          stopReason = 'ai_user_stop'
          stopDetail = msg
          verdict = 'fail'
          verdictReason = msg
          break outer
        }

        if (decision.action === 'stop') {
          console.log(
            `  [AI STOP] verdict=${decision.verdict} — ${decision.reason}`,
          )
          steps.push({
            type: 'ai_stop',
            round,
            verdict: decision.verdict,
            reason: decision.reason,
          })
          stopReason = 'ai_user_stop'
          stopDetail = decision.reason
          verdict = decision.verdict
          verdictReason = decision.reason
          break outer
        }

        if (decision.action !== 'respond_tool') {
          const msg = 'AI user produced text reply while a tool response was expected'
          console.log(`  [AI ERROR] ${msg}`)
          steps.push({ type: 'error', round, message: msg })
          stopReason = 'ai_user_stop'
          stopDetail = msg
          verdict = 'fail'
          verdictReason = msg
          break outer
        }

        const response = JSON.stringify(decision.response)
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

      continue
    }

    // =================================================================
    // CASE 2: Text only (possibly with backend handoffs) — ask AI for reply
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

      let decision
      try {
        decision = await askAiUser(
          config,
          { kind: 'text', assistantText: roundData.textMessages.join('\n') } satisfies AiUserContext,
          steps,
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`  [AI ERROR] ${msg}`)
        steps.push({ type: 'error', round, message: `AI user error: ${msg}` })
        stopReason = 'ai_user_stop'
        stopDetail = msg
        verdict = 'fail'
        verdictReason = msg
        break
      }

      if (decision.action === 'stop') {
        console.log(`  [AI STOP] verdict=${decision.verdict} — ${decision.reason}`)
        steps.push({
          type: 'ai_stop',
          round,
          verdict: decision.verdict,
          reason: decision.reason,
        })
        stopReason = 'ai_user_stop'
        stopDetail = decision.reason
        verdict = decision.verdict
        verdictReason = decision.reason
        break
      }

      if (decision.action !== 'respond_text') {
        const msg = 'AI user produced tool response while a text reply was expected'
        console.log(`  [AI ERROR] ${msg}`)
        steps.push({ type: 'error', round, message: msg })
        stopReason = 'ai_user_stop'
        stopDetail = msg
        verdict = 'fail'
        verdictReason = msg
        break
      }

      const reply = decision.text
      textMessageCount++
      console.log(`  -> User reply: "${reply}" (${textMessageCount}/${maxTextMessages})`)
      steps.push({ type: 'user_text', round, text: reply })
      agent.addMessage({ id: randomUUID(), role: 'user', content: reply })

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
  if (verdict) {
    console.log(`  AI verdict: ${verdict}${verdictReason ? ` — ${verdictReason}` : ''}`)
  }

  return {
    steps,
    rounds: round,
    stopReason,
    stopDetail,
    name: config.name,
    verdict,
    verdictReason,
  }
}

/**
 * Throws a descriptive error if the AI run did not end with `verdict === 'pass'`.
 * Use this in tests instead of a raw `expect(...).toBe('pass')` so the failure
 * message surfaces the verdict reason and the stop reason from the AI runner.
 */
export function expectAiPass(result: AiRunResult): void {
  if (result.verdict === 'pass') return

  const lines = [
    `AI scenario did not pass: "${result.name}"`,
    `  Verdict: ${result.verdict ?? '(no verdict — AI did not emit stop)'}`,
    `  Reason:  ${result.verdictReason ?? '(no reason provided)'}`,
    `  Stop:    ${result.stopReason}${result.stopDetail ? ' — ' + result.stopDetail : ''}`,
  ]
  throw new Error(lines.join('\n'))
}
