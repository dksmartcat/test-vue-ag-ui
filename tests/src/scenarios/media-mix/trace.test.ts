import { it } from 'vitest'
import { TOKEN } from '../../config'
import { traceScenario } from '../../trace'
import { mediaMix } from './scenario'

it('TRACE: Media mix translation', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  await traceScenario(mediaMix)
})
