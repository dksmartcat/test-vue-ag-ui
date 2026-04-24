import { it } from 'vitest'
import { TOKEN, AI_USER_URL, AI_USER_API_KEY, AI_USER_MODEL } from '../../../config'
import { runAiScenario, expectAiPass, printSteps, saveChatHtml } from '../../../scenario'
import { aiRetranslateAfterHelpCenterUser } from './scenario'

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
  'AI user — translate, ask help center, retranslate last file to Spanish',
  { timeout: TIMEOUT },
  async () => {
    if (skip()) return
    const result = await runAiScenario(aiRetranslateAfterHelpCenterUser)
    saveChatHtml(result, import.meta.url)
    expectAiPass(result)
  },
)

it(
  'AI user — translate, ask help center, retranslate last file to Spanish — trace',
  { timeout: TIMEOUT },
  async () => {
    if (skip()) return
    const result = await runAiScenario(aiRetranslateAfterHelpCenterUser)
    printSteps(result.steps)
    saveChatHtml(result, import.meta.url)
    expectAiPass(result)
  },
)
