import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../scenario'
import { singlePdfUser, singlePdfExpected } from './scenario'

const TIMEOUT = 2_000_000

it('Single PDF translation (.pdf -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  const result = await runScenario(singlePdfUser)
  saveChatHtml(result, import.meta.url)
  const verification = verifySteps(result, singlePdfExpected)
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Single PDF translation — trace', { timeout: TIMEOUT }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  const result = await runScenario(singlePdfUser)
  printSteps(result.steps)
  saveChatHtml(result, import.meta.url)
})
