import { describe, it, expect } from 'vitest'
import { TOKEN } from './config'
import { runScenario, type FlowScenario } from './scenario'
import { subtitlesTranslation, voiceoverMp3, voiceoverMp4, batchTxt } from './scenarios'

const TIMEOUT = 300_000

function skip() {
  if (!TOKEN) {
    console.warn('Skipping: TOKEN is not set in config.ts')
    return true
  }
  return false
}

async function assertScenario(scenario: FlowScenario) {
  if (skip()) return
  const result = await runScenario(scenario)
  expect(result.error).toBeNull()
  expect(result.success).toBe(true)
}

describe('Translation Flow Scenarios', () => {
  it('Subtitles translation (.srt → EN→RU)', { timeout: TIMEOUT }, () =>
    assertScenario(subtitlesTranslation))

  it('Voiceover translation (.mp3 → EN→RU)', { timeout: TIMEOUT }, () =>
    assertScenario(voiceoverMp3))

  it('Voiceover translation (.mp4 → EN→RU)', { timeout: TIMEOUT }, () =>
    assertScenario(voiceoverMp4))

  it('Batch document translation (20x .txt → EN→RU)', { timeout: TIMEOUT }, () =>
    assertScenario(batchTxt))
})
