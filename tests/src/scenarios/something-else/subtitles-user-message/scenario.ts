import type { UserConfig, ExpectedScenario } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'
import { aiTranslationStages, confirm, displayed, userMessage } from '../../../tools/handlers'

/**
 * Subtitles translation where every picker tool is answered purely with a
 * free-text `userMessage` — nothing is picked from the structural list.
 * The LLM must interpret each reply in context and map it to the correct
 * downstream structured values (BCP 47 tags, canonical output format name,
 * subtitle parameter numbers).
 */
export const subtitlesUserMessageUser: UserConfig = {
  name: 'Subtitles translation — all picker answers via userMessage',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  handlers: {
    choose_source_language: userMessage('английский'),
    choose_target_language: userMessage('русский'),
    choose_workflow_stages: aiTranslationStages,
    choose_file_output: userMessage('только субтитры'),
    choose_subtitles_parameters: userMessage(
      '42 символа в строке, 2 строки в кадре, 25 символов в секунду',
    ),
    confirm_action: confirm,
    display_project: displayed,
  },
  maxRounds: 15,
  maxTextMessages: 3,
}

export const subtitlesUserMessageExpected: ExpectedScenario = {
  optionalTools: ['handoff_to_'],
  steps: [
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
    { tool: 'file_preprocessing', resultContains: 'Subtitles' },
    { tool: 'load_skill', resultContains: 'media-translation' },
    { tool: 'choose_workflow_stages' },
    { tool: 'choose_file_output' },
    { tool: 'choose_subtitles_parameters' },
    { tool: 'confirm_action' },
    { tool: 'start_subtitles_translation_workflow' },
    { tool: 'await_project_creation' },
    { tool: 'await_auto_translation' },
  ],
}
