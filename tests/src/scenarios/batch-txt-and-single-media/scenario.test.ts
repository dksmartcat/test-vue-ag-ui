import { it, expect } from 'vitest'
import { TOKEN } from '../../config'
import { runScenario, verifySteps, printSteps, saveChatHtml } from '../../scenario'
import { batchTxtUser, batchTxtExpected } from './scenario'

const TIMEOUT = 2_000_000

function skip() {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set')
    return true
  }
  return false
}

it('Batch document translation (.txt) — trace', { timeout: TIMEOUT }, async () => {
  if (skip()) return
  const result = await runScenario(batchTxtUser())
  printSteps(result.steps)
  saveChatHtml(result, import.meta.url)
})
