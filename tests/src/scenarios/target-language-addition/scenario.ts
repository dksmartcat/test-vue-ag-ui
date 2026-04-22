import type { UserConfig, ExpectedScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'
import { sourceEn } from '../../tools/handlers'
import type { ToolHandler } from '../../tools/types'

/**
 * Multi-select addition: user picks one target language from the list AND
 * types an extra language in `something else`. The final set of target
 * languages must include BOTH the picked one and the one parsed from the
 * free-text addition.
 *
 * Flow:
 *   - source: `en` (structural pick)
 *   - target: `{ targetLanguageTags: ['ru'], userMessage: 'и немецкий' }`
 *   - LLM merges → final target list includes `ru` and a `de` variant
 *   - Verified via a `check` on `file_preprocessing` args.
 */
const targetRuPlusGerman: ToolHandler = () =>
  JSON.stringify({ targetLanguageTags: ['ru'], userMessage: 'и немецкий' })

export const targetLanguageAdditionUser: UserConfig = {
  name: 'Multi-select target language — structural pick + userMessage addition',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  handlers: {
    choose_source_language: sourceEn,
    choose_target_language: targetRuPlusGerman,
  },
  stopOnToolCall: (toolName) => toolName === 'file_preprocessing',
  maxRounds: 6,
  maxTextMessages: 2,
}

export const targetLanguageAdditionExpected: ExpectedScenario = {
  optionalTools: ['handoff_to_', 'load_skill'],
  steps: [
    { tool: 'choose_source_language' },
    { tool: 'choose_target_language' },
    {
      tool: 'file_preprocessing',
      check(args) {
        const tags = (args.targetLanguageTags as string[] | undefined) ?? []
        const hasRu = tags.some((t) => t.toLowerCase().startsWith('ru'))
        const hasDe = tags.some((t) => t.toLowerCase().startsWith('de'))
        if (!hasRu || !hasDe) {
          throw new Error(
            `Expected targetLanguageTags to contain both a "ru" and a "de" variant, got: ${JSON.stringify(tags)}`,
          )
        }
      },
    },
  ],
}
