import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps } from '../../scenario'
import { subtitlesUserMessageUser, subtitlesUserMessageExpected } from './scenario'

const TIMEOUT = 2_000_000

it(
  'Subtitles translation — all picker answers via userMessage',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(subtitlesUserMessageUser)
    const verification = verifySteps(result, subtitlesUserMessageExpected)
    expect(verification.error).toBeNull()
    expect(verification.success).toBe(true)
  },
)

it(
  'Subtitles translation — all picker answers via userMessage — trace',
  { timeout: TIMEOUT },
  async () => {
    if (!TOKEN) {
      console.warn('Skipping: TOKEN is not set')
      return
    }
    const result = await runScenario(subtitlesUserMessageUser)
    printSteps(result.steps)
  },
)
