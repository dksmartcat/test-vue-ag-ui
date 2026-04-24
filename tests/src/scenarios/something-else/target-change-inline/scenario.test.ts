import { it, expect } from 'vitest'
import { TOKEN } from '../../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../../scenario'
import { targetChangeInlineUser, targetChangeInlineExpected } from './scenario'

const TIMEOUT = 2_000_000

it(
  'Target change via userMessage names the language inline',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(targetChangeInlineUser())
    saveChatHtml(result, import.meta.url)
    const verification = verifySteps(result, targetChangeInlineExpected)
    expect(verification.error).toBeNull()
    expect(verification.success).toBe(true)
  },
)

it(
  'Target change via userMessage names the language inline — trace',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(targetChangeInlineUser())
    printSteps(result.steps)
    saveChatHtml(result, import.meta.url)
  },
)
