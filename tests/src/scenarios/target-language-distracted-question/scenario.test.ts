import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps } from '../../scenario'
import {
  targetLanguageDistractedQuestionUser,
  targetLanguageDistractedQuestionExpected,
} from './scenario'

const TIMEOUT = 2_000_000

it(
  'Distracted question on target-language selection',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(targetLanguageDistractedQuestionUser())
    const verification = verifySteps(result, targetLanguageDistractedQuestionExpected)
    expect(verification.error).toBeNull()
    expect(verification.success).toBe(true)
  },
)

it(
  'Distracted question on target-language selection — trace',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(targetLanguageDistractedQuestionUser())
    printSteps(result.steps)
  },
)
