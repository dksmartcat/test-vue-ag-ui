/**
 * Plain-text transcript printer for scenario runs.
 */
import type { RecordedStep } from './types'

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
      case 'ai_stop':
        console.log(`  [AI_STOP ${step.verdict}] ${step.reason}`)
        break
    }
  }

  const toolCalls = steps.filter(
    (s): s is Extract<RecordedStep, { type: 'tool_call' }> => s.type === 'tool_call',
  )
  const backendCalls = toolCalls.filter((s) => s.source === 'backend')
  const frontendCalls = toolCalls.filter((s) => s.source === 'frontend')
  const texts = steps.filter((s) => s.type === 'assistant_text')
  const userTexts = steps.filter((s) => s.type === 'user_text')
  const userToolResponses = steps.filter((s) => s.type === 'user_tool_response')
  const errors = steps.filter((s) => s.type === 'error')
  const aiStops = steps.filter(
    (s): s is Extract<RecordedStep, { type: 'ai_stop' }> => s.type === 'ai_stop',
  )

  console.log(`\n=== Steps summary ===`)
  console.log(
    `  Tool calls: ${toolCalls.length} (${backendCalls.length} backend, ${frontendCalls.length} frontend)`,
  )
  console.log(`  Assistant messages: ${texts.length}`)
  console.log(`  User responses: ${userToolResponses.length} tool, ${userTexts.length} text`)
  if (errors.length > 0) console.log(`  Errors: ${errors.length}`)
  if (aiStops.length > 0) {
    const verdict = aiStops[aiStops.length - 1]!.verdict
    console.log(`  AI verdict: ${verdict}`)
  }
}
