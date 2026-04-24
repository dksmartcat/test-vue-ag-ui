import type { ClassicUserConfig, ExpectedScenario } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'
import { sourceEn, targetRu, userMessage } from '../../../tools/handlers'

/**
 * At the workflow-stages step the user types a new target language inline
 * ("хочу поменять язык на немецкий") instead of picking a stage set.
 *
 * Expected happy path:
 *   1. source → en (structural)
 *   2. target → ru (structural)
 *   3. file_preprocessing (with ru)
 *   4. choose_workflow_stages → user replies with userMessage naming German
 *   5. translation_flow hands off back to file_intake
 *   6. file_intake recognizes "немецкий" as an unambiguous target language
 *      → re-runs file_preprocessing with `de`-variant WITHOUT calling
 *        choose_target_language again
 *   7. hand off back to translation_flow → choose_workflow_stages fires again
 *
 * Stop conditions (whichever happens first):
 *   - Second `choose_target_language` call — FAILURE: the skip-if-clear rule
 *     didn't kick in, the picker was re-invoked needlessly.
 *   - Second `choose_workflow_stages` call — SUCCESS: flow went straight from
 *     "change target" (in text) to re-preprocessing to workflow again.
 *
 * Plain-text replies from the user are disallowed (`maxTextMessages: 0`) —
 * this flow must be driven entirely by tool interactions.
 */
export function targetChangeInlineUser(): ClassicUserConfig {
  let targetLanguageCalls = 0
  let workflowStagesCalls = 0

  return {
    name: 'Target change via userMessage names the language inline',
    message: 'translate',
    files: loadScenarioFiles(import.meta.url),
    handlers: {
      choose_source_language: sourceEn,
      choose_target_language: targetRu,
      choose_workflow_stages: userMessage('хочу поменять язык на немецкий'),
    },
    stopOnToolCall: (toolName) => {
      if (toolName === 'choose_target_language') {
        targetLanguageCalls++
        return targetLanguageCalls >= 2
      }
      if (toolName === 'choose_workflow_stages') {
        workflowStagesCalls++
        return workflowStagesCalls >= 2
      }
      return false
    },
    maxRounds: 6,
    maxTextMessages: 0,
  }
}

export const targetChangeInlineExpected: ExpectedScenario = {
  optionalTools: ['handoff_to_', 'load_skill'],
  steps: [
    { tool: 'choose_source_language' },
    { tool: 'choose_target_language' },
    { tool: 'file_preprocessing' },
    { tool: 'choose_workflow_stages' },
    {
      tool: 'file_preprocessing',
      check(args) {
        const tags = (args.targetLanguageTags as string[] | undefined) ?? []
        const hasDe = tags.some((t) => t.toLowerCase().startsWith('de'))
        if (!hasDe) {
          throw new Error(
            `Expected second file_preprocessing to use a "de" target, got: ${JSON.stringify(tags)}`,
          )
        }
      },
    },
    { tool: 'choose_workflow_stages' },
  ],
}
