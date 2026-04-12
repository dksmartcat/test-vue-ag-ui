import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario } from '../../scenario'
import { mediaMix } from './scenario'

it('Media mix translation (mp3+mp4+srt → EN→RU)', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return
  }
  const result = await runScenario(mediaMix)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})
