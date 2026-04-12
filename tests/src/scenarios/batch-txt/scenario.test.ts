import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario } from '../../scenario'
import { batchTxt10, batchTxt20, batchTxt50 } from './scenario'

const TIMEOUT = 2_000_000

function skip() {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return true
  }
  return false
}

it('Batch document translation (10x .txt → EN→RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxt10)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})

it('Batch document translation (20x .txt → EN→RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxt20)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})

it('Batch document translation (50x .txt → EN→RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxt50)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})
