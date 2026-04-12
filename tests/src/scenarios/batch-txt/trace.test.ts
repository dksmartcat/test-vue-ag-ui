import { it } from 'vitest'
import { TOKEN } from '../../config'
import { traceScenario } from '../../trace'
import { batchTxt10 } from './scenario'

it('TRACE: Batch txt (10x)', { timeout: 2_000_000 }, async () => {
  if (!TOKEN) { console.warn('Skipping: TOKEN is not set'); return }
  await traceScenario(batchTxt10)
})
