import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'

/**
 * .mp3 file → voiceover translation workflow.
 */
export const voiceoverMp3: FlowScenario = {
  name: 'Voiceover translation (.mp3 → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  rounds: [
    { round: 1, steps: [{ tool: 'choose_source_language' }] },
    { round: 2, steps: [{ tool: 'choose_target_language' }] },
    {
      round: 3,
      steps: [
        { tool: 'file_preprocessing' },
        { tool: 'load_skill', resultContains: 'media-translation' },
        {
          tool: 'choose_file_output',
          handler: () => JSON.stringify({ selected: 'Voice-over' }),
        },
      ],
    },
    { round: 4, steps: [{ tool: 'choose_voice_preset' }] },
    { round: 5, steps: [{ tool: 'confirm_action' }] },
    { round: 6, steps: [{ tool: 'start_voiceover_translation_workflow' }] },
  ],
}
