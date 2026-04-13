import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps } from '../../scenario'
import { batchTxtUser, batchTxtExpected } from './scenario'

const TIMEOUT = 2_000_000

function skip() {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return true
  }
  return false
}

it('Batch document translation (10x .txt -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxtUser(10))
  const verification = verifySteps(result, batchTxtExpected(10))
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Batch document translation (20x .txt -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxtUser(20))
  const verification = verifySteps(result, batchTxtExpected(20))
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Batch document translation (50x .txt -> EN->RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxtUser(50))
  const verification = verifySteps(result, batchTxtExpected(50))
  expect(verification.error).toBeNull()
  expect(verification.success).toBe(true)
})

it('Batch document translation (.txt) — trace', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxtUser(100))
  printSteps(result.steps)
})
