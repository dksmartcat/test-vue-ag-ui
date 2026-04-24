import { it, expect } from 'vitest'
import { TOKEN } from '../../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../../scenario'
import {
  userMessageSourceAndTargetChangeUser,
  userMessageSourceAndTargetChangeExpected,
} from './scenario'

const TIMEOUT = 2_000_000

it(
  'userMessage → re-collect source + target languages via FileIntake handoff',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(userMessageSourceAndTargetChangeUser())
    saveChatHtml(result, import.meta.url)
    const verification = verifySteps(result, userMessageSourceAndTargetChangeExpected)
    expect(verification.error).toBeNull()
    expect(verification.success).toBe(true)
  },
)

it(
  'userMessage → re-collect source + target languages — trace',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(userMessageSourceAndTargetChangeUser())
    printSteps(result.steps)
    saveChatHtml(result, import.meta.url)
  },
)
