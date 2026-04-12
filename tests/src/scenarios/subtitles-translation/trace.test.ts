import { it } from 'vitest'
import { TOKEN } from '../../config'
import { traceScenario } from '../../trace'
import { subtitlesTranslation } from './scenario'

it('TRACE: Subtitles translation', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  await traceScenario(subtitlesTranslation)
})
