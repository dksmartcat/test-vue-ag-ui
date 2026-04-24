import type { AiUserConfig } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'

/**
 * AI-driven scenario: user changes their target language mid-flow, at the
 * workflow-stages step, by typing the new language inline (free text).
 *
 * The AI is responsible for deciding when the scenario passed or failed.
 * The success milestone is the agent reaching `confirm_action` after
 * re-processing the file with the NEW target language (German).
 */
export const aiTargetChangeOnWorkflowUser: AiUserConfig = {
  name: 'AI user — target language changed on workflow step',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  scenario: [
    'You are a user who uploaded a .srt subtitle file.',
    '',
    'Behavior:',
    '- Source language: English.',
    '- Initially pick Russian as the target language.',
    "- IMPORTANT: when the workflow-stages picker appears FOR THE FIRST TIME, do NOT pick a stage —",
    "  instead reply via the tool's free-text input saying you want to change the target language to German.",
    "  Say 'German' only once; do not repeat this later.",
    '- When the workflow-stages picker appears AGAIN, accept the default stage set.',
    '- For file output, pick subtitles only.',
    '- For subtitle parameters, accept the defaults.',
    '- When the agent asks to confirm, confirm.',
    '',
    'Exit conditions:',
    '- PASS: the agent invokes `confirm_action` AFTER the second `file_preprocessing`',
    '  call, and that second `file_preprocessing` used a German target (a `de` variant',
    '  such as `de`, `de-DE`, `de-AT`). Emit pass as soon as confirm_action appears',
    '  with the correct target, without continuing the flow.',
    '- FAIL: the agent re-invokes `choose_target_language` after the inline German',
    '  mention (the picker should not appear when the language was already named),',
    '  or loops between handoffs, or never reaches confirm_action within the round',
    '  budget, or confirms a plan with the wrong target language (Russian instead of',
    '  German).',
  ].join('\n'),
  maxRounds: 20,
  maxTextMessages: 5,
}
