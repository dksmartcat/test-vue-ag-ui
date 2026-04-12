import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario } from '../../scenario'
import { subtitlesTranslation } from './scenario'

it('Subtitles translation (.srt → EN→RU)', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return
  }
  const result = await runScenario(subtitlesTranslation)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
})
