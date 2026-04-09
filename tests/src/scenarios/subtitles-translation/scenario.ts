import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'

export const subtitlesTranslation: FlowScenario = {
  name: 'Subtitles translation (.srt → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  optionalTools: ['handoff_to_'],
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
  ],
}
