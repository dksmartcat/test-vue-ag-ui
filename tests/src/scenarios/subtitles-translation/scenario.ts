import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'

/**
 * .srt file → subtitles translation workflow.
 */
export const subtitlesTranslation: FlowScenario = {
  name: 'Subtitles translation (.srt → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  rounds: [
    { round: 1, steps: [{ tool: 'choose_source_language' }] },
    { round: 2, steps: [{ tool: 'choose_target_language' }] },
    {
      round: 3,
      steps: [
        { tool: 'file_preprocessing', resultContains: 'Subtitles' },
        { tool: 'load_skill', resultContains: 'media-translation' },
        { tool: 'choose_file_output' },
      ],
    },
    { round: 4, steps: [{ tool: 'choose_subtitles_parameters' }] },
    { round: 5, steps: [{ tool: 'confirm_action' }] },
    { round: 6, steps: [{ tool: 'start_subtitles_translation_workflow' }] },
  ],
}
