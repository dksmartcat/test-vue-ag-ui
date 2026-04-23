import { it, expect } from 'vitest'
import { TOKEN } from '../../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../../scenario'
import { mediaMixUser, mediaMixExpected } from './scenario'

const TIMEOUT = 2_000_000

it('Media mix translation (mp3+mp4+srt -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return
  }
  const result = await runScenario(mediaMixUser)
  saveChatHtml(result, import.meta.url)
  const verification = verifySteps(result, mediaMixExpected)
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Media mix translation — trace', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  const result = await runScenario(mediaMixUser)
  printSteps(result.steps)
  saveChatHtml(result, import.meta.url)
})
