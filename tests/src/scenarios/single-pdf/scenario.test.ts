import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario } from '../../scenario'
import { singlePdf } from './scenario'

it('Single PDF translation (.pdf → EN→RU)', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return
  }
  const result = await runScenario(singlePdf)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})
