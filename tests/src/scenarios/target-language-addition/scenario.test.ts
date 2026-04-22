import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps } from '../../scenario'
import {
  targetLanguageAdditionUser,
  targetLanguageAdditionExpected,
} from './scenario'

const TIMEOUT = 2_000_000

it(
  'Multi-select target language — structural pick + userMessage addition',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(targetLanguageAdditionUser)
    const verification = verifySteps(result, targetLanguageAdditionExpected)
    expect(verification.error).toBeNull()
    expect(verification.success).toBe(true)
  },
)

it(
  'Multi-select target language — structural pick + userMessage addition — trace',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(targetLanguageAdditionUser)
    printSteps(result.steps)
  },
)
