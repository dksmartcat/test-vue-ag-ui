import type { ClassicUserConfig, ExpectedScenario } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'
import { sourceEn, targetRu, userMessage } from '../../../tools/handlers'

/**
 * Verifies that a free-text `userMessage` returned from a picker tool is
 * treated as a regular user chat message by the agents:
 *
 *   1. User uploads a .txt file, says "translate".
 *   2. Agent asks for source language → picks `en`.
 *   3. Agent asks for target language (1st call) → picks `ru`.
 *   4. File is preprocessed, flow hands off to TranslationFlow.
 *   5. Agent asks for workflow stages → user replies with
 *      `userMessage = "хочу поменять таргет языки"` instead of picking a stage.
 *   6. TranslationFlow recognizes this is out-of-scope (target language is
 *      owned by FileIntake) and hands off back to FileIntake.
 *   7. FileIntake resets Step 4 to `[ ]` (per its instructions on user-
 *      initiated changes) and re-invokes `choose_target_language`.
 *
 * Run is stopped via `stopOnToolCall` as soon as the second
 * `choose_target_language` call is recorded.
 */
export function userMessageTargetChangeUser(): ClassicUserConfig {
  let targetLanguageCalls = 0

  return {
    name: 'userMessage → re-collect target language via FileIntake handoff',
    message: 'translate',
    files: loadScenarioFiles(import.meta.url),
    handlers: {
      choose_source_language: sourceEn,
      choose_target_language: targetRu,
      choose_workflow_stages: userMessage('хочу поменять таргет языки'),
    },
    stopOnToolCall: (toolName) => {
      if (toolName === 'choose_target_language') {
        targetLanguageCalls++
        return targetLanguageCalls >= 2
      }
      return false
    },
    maxRounds: 5,
    maxTextMessages: 2,
  }
}

export const userMessageTargetChangeExpected: ExpectedScenario = {
  // Inter-agent handoffs are backend noise — allow them anywhere.
  optionalTools: ['handoff_to_'],
  steps: [
    // Step 3 — source language
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },

    // Step 4 — target language (1st collection)
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },

    // Step 5 — preprocessing, then handoff to TranslationFlow
    { tool: 'file_preprocessing' },

    // TranslationFlow picks a workflow skill, then asks for stages
    { tool: 'load_skill', optional: true },
    { tool: 'choose_workflow_stages' },

    // User's `userMessage` triggers handoff back to FileIntake,
    // which re-collects target language (2nd call).
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
  ],
}
