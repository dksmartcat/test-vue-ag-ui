import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../scenario'
import { subtitlesUser, subtitlesExpected } from './scenario'

const TIMEOUT = 2_000_000

it('Subtitles translation (.srt -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return
  }
  const result = await runScenario(subtitlesUser)
  saveChatHtml(result, import.meta.url)
  const verification = verifySteps(result, subtitlesExpected)
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Subtitles translation — trace', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  const result = await runScenario(subtitlesUser)
  printSteps(result.steps)
  saveChatHtml(result, import.meta.url)
})
