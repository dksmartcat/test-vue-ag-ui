import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario } from '../../scenario'
import { mixedCategories } from './scenario'

it('Mixed categories (mp3+mp4+srt+pdf → EN→RU)', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return
  }
  const result = await runScenario(mixedCategories)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})
