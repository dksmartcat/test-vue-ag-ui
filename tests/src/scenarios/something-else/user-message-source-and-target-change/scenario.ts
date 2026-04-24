import type { ClassicUserConfig, ExpectedScenario } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'
import { sourceEn, targetRu, userMessage } from '../../../tools/handlers'
import type { ToolHandler } from '../../../tools/types'

/**
 * User wants to change BOTH source AND target languages via free-text
 * `userMessage` while on the workflow stage selection step.
 *
 *   1. .txt file → "translate"
 *   2. source language → `en` (structural pick, 1st call)
 *   3. target language → `ru` (structural pick, 1st call)
 *   4. file preprocessing
 *   5. workflow stages → `userMessage: "хочу поменять и сорс и таргет"`
 *   6. TranslationFlow recognizes both params are out of scope → handoff to FileIntake
 *   7. FileIntake resets both Step 3 and Step 4 → re-invokes
 *      `choose_source_language` (2nd call) then `choose_target_language` (2nd call).
 *
 * The 2nd source/target handlers return different values (`fr` / `de`) so the
 * re-collection can be distinguished from the original one if one inspects
 * the transcript.
 *
 * Run is stopped via `stopOnToolCall` as soon as the 2nd
 * `choose_target_language` call is recorded.
 */
export function userMessageSourceAndTargetChangeUser(): ClassicUserConfig {
  let sourceLanguageCalls = 0
  let targetLanguageCalls = 0

  const sourceHandler: ToolHandler = (args) => {
    sourceLanguageCalls++
    return sourceLanguageCalls === 1
      ? sourceEn(args)
      : JSON.stringify({ sourceLanguageTag: 'fr' })
  }

  const targetHandler: ToolHandler = (args) => {
    targetLanguageCalls++
    return targetLanguageCalls === 1
      ? targetRu(args)
      : JSON.stringify({ targetLanguageTags: ['de'] })
  }

  return {
    name: 'userMessage → re-collect source + target languages via FileIntake handoff',
    message: 'translate',
    files: loadScenarioFiles(import.meta.url),
    handlers: {
      choose_source_language: sourceHandler,
      choose_target_language: targetHandler,
      choose_workflow_stages: userMessage('хочу поменять и сорс и таргет'),
    },
    stopOnToolCall: (toolName) => {
      return toolName === 'choose_target_language' && targetLanguageCalls >= 2
    },
    maxRounds: 10,
    maxTextMessages: 2,
  }
}

export const userMessageSourceAndTargetChangeExpected: ExpectedScenario = {
  optionalTools: ['handoff_to_'],
  steps: [
    // 1st intake pass
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
    { tool: 'file_preprocessing' },

    // Workflow selection triggers the userMessage that asks to change both.
    { tool: 'load_skill', optional: true },
    { tool: 'choose_workflow_stages' },

    // 2nd intake pass after handoff back — both steps re-collected in order.
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
  ],
}
