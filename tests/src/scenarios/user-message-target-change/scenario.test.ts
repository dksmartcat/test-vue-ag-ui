import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps } from '../../scenario'
import {
  userMessageTargetChangeUser,
  userMessageTargetChangeExpected,
} from './scenario'

const TIMEOUT = 2_000_000

it(
  'userMessage → re-collect target language via FileIntake handoff',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(userMessageTargetChangeUser())
    const verification = verifySteps(result, userMessageTargetChangeExpected)
    expect(verification.error).toBeNull()
    expect(verification.success).toBe(true)
  },
)

it(
  'userMessage → re-collect target language — trace',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(userMessageTargetChangeUser())
    printSteps(result.steps)
  },
)
