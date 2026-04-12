import { it } from 'vitest'
import { TOKEN } from '../../config'
import { traceScenario } from '../../trace'
import { singlePdf } from './scenario'

it('TRACE: Single PDF translation', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  await traceScenario(singlePdf)
})
