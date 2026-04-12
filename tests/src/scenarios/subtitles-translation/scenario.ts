import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'
import {
  sourceEn,
  targetRu,
  subtitlesOnly,
  defaultSubtitlesParams,
  confirm,
  displayed,
} from '../../tools/handlers'

export const subtitlesTranslation: FlowScenario = {
  name: 'Subtitles translation (.srt → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  optionalTools: ['handoff_to_'],
  handlers: {
    choose_source_language: sourceEn,
    choose_target_language: targetRu,
    choose_file_output: subtitlesOnly,
    choose_subtitles_parameters: defaultSubtitlesParams,
    confirm_action: confirm,
    display_project: displayed,
  },
  steps: [
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
    { tool: 'file_preprocessing', resultContains: 'Subtitles' },
    { tool: 'load_skill', resultContains: 'media-translation' },
    { tool: 'choose_file_output' },
    { tool: 'choose_subtitles_parameters' },
    { tool: 'confirm_action' },
    { tool: 'start_subtitles_translation_workflow' },
    { tool: 'await_project_creation' },
    { tool: 'await_auto_translation' },
    { tool: 'display_project' },
  ],
}
