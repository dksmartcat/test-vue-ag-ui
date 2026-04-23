import { it, expect } from 'vitest'
import { TOKEN } from '../../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../../scenario'
import { batchDocxUser, batchDocxExpected } from './scenario'

const TIMEOUT = 2_000_000

function skip() {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return true
  }
  return false
}

it('Batch document translation (10x .docx -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchDocxUser(10))
  saveChatHtml(result, import.meta.url, 'batch-docx-10')
  const verification = verifySteps(result, batchDocxExpected(10))
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Batch document translation (20x .docx -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchDocxUser(20))
  saveChatHtml(result, import.meta.url, 'batch-docx-20')
  const verification = verifySteps(result, batchDocxExpected(20))
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Batch document translation (50x .docx -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchDocxUser(50))
  saveChatHtml(result, import.meta.url, 'batch-docx-50')
  const verification = verifySteps(result, batchDocxExpected(50))
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Batch document translation (.docx) — trace', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchDocxUser(10))
  printSteps(result.steps)
  saveChatHtml(result, import.meta.url, 'batch-docx-trace')
})
