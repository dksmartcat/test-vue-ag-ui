import type { ClassicUserConfig, ExpectedScenario } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'
import { sourceEn, userMessage } from '../../../tools/handlers'

/**
 * User asks an off-topic question in `something else` during target-language
 * selection instead of answering. Expected agent behavior:
 *   - Recognize this is not an answer, respond with a text reply.
 *   - Re-invoke `choose_target_language` so the user can answer properly.
 *
 * The run stops as soon as the second `choose_target_language` call is
 * recorded; we don't need to complete the flow.
 */
export function targetLanguageDistractedQuestionUser(): ClassicUserConfig {
  let targetLanguageCalls = 0

  return {
    name: 'Distracted question on target-language selection',
    message: 'translate',
    files: loadScenarioFiles(import.meta.url),
    handlers: {
      choose_source_language: sourceEn,
      choose_target_language: userMessage(
        'как в смарткате переводить текстовые файлы?',
      ),
    },
    stopOnToolCall: (toolName) => {
      if (toolName === 'choose_target_language') {
        targetLanguageCalls++
        return targetLanguageCalls >= 2
      }
      return false
    },
    maxRounds: 8,
    maxTextMessages: 2,
    textReply: "продолжи перевод"
  }
}

export const targetLanguageDistractedQuestionExpected: ExpectedScenario = {
  optionalTools: ['handoff_to_'],
  steps: [
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
    // After user's off-topic question, the agent must reply in text
    // before invoking the tool again.
    { text: true },
    { tool: 'choose_target_language' },
  ],
}
