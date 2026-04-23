import { it, expect } from 'vitest'
import { TOKEN } from '../../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../../scenario'
import { mixedCategoriesUser, mixedCategoriesExpected } from './scenario'

const TIMEOUT = 2_000_000

it('Mixed categories (mp3+mp4+srt+pdf -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return
  }
  const result = await runScenario(mixedCategoriesUser)
  saveChatHtml(result, import.meta.url)
  const verification = verifySteps(result, mixedCategoriesExpected)
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Mixed categories — trace', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  const result = await runScenario(mixedCategoriesUser)
  printSteps(result.steps)
  saveChatHtml(result, import.meta.url)
})
