import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario } from '../../scenario'
import { batchDocx10, batchDocx20, batchDocx50 } from './scenario'

const TIMEOUT = 2_000_000

function skip() {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return true
  }
  return false
}

it('Batch document translation (10x .docx → EN→RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchDocx10)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})

it('Batch document translation (20x .docx → EN→RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchDocx20)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})

it('Batch document translation (50x .docx → EN→RU)', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchDocx50)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})
