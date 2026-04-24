import type { AiUserConfig } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'

/**
 * AI-driven subtitles translation scenario — self-contained.
 *
 * The scenario text describes both the user's behavior AND the exit
 * conditions. The AI emits verdict="pass" when the agent reaches the
 * success milestone, and verdict="fail" on any divergence.
 */
export const subtitlesTranslationAiUser: AiUserConfig = {
  name: 'Subtitles translation (AI user, .srt -> EN->RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  scenario: [
    'You are a user who wants to translate an uploaded .srt subtitle file.',
    '',
    'Behavior:',
    '- Source language: English.',
    '- Target language: Russian.',
    '- Output type: subtitles only (no voice-over).',
    '- Subtitle parameters: accept the defaults the tool suggests.',
    '- Workflow stages: accept the default stage set.',
    '- When the agent asks to confirm the plan, confirm.',
    '- Never change your mind during the flow; always stay on the path described above.',
    '',
    'Exit conditions:',
    '- PASS: the agent calls `display_project` (or an equivalent completion tool) after',
    '  confirmation, indicating the translation project was successfully created.',
    '  Emit the pass verdict as soon as you see this — do not continue the conversation.',
    '- FAIL: the agent skips a required step (source language, target language,',
    '  preprocessing, output type, subtitle parameters, confirmation), asks for data',
    '  that is already clear from the conversation, loops between handoffs, or produces',
    '  any error that blocks progress.',
  ].join('\n'),
  maxRounds: 15,
  maxTextMessages: 3,
}
