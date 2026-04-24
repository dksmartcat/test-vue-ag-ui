import { it } from 'vitest'
import { TOKEN, AI_USER_URL, AI_USER_API_KEY, AI_USER_MODEL } from '../../../config'
import { runAiScenario, expectAiPass, printSteps, saveChatHtml } from '../../../scenario'
import { aiTargetChangeOnWorkflowUser } from './scenario'

const TIMEOUT = 2_000_000

function skip(): boolean {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return true
  }
  if (!AI_USER_URL || !AI_USER_API_KEY || !AI_USER_MODEL) {
    console.warn('Skipping: AI_USER_URL / AI_USER_API_KEY / AI_USER_MODEL are not set')
    return true
  }
  return false
}

it(
  'AI user — target language changed on workflow step',
  { timeout: TIMEOUT },
  async () => {
    if (skip()) return
    const result = await runAiScenario(aiTargetChangeOnWorkflowUser)
    saveChatHtml(result, import.meta.url)
    expectAiPass(result)
  },
)

it(
  'AI user — target language changed on workflow step — trace',
  { timeout: TIMEOUT },
  async () => {
    if (skip()) return
    const result = await runAiScenario(aiTargetChangeOnWorkflowUser)
    printSteps(result.steps)
    saveChatHtml(result, import.meta.url)
    expectAiPass(result)
  },
)
