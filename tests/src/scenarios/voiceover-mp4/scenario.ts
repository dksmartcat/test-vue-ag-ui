import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'

export const voiceoverMp4: FlowScenario = {
  name: 'Voiceover translation (.mp4 → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  optionalTools: ['handoff_to_'],
  steps: [
    { tool: 'choose_source_language' },
    { tool: 'choose_target_language' },
    { tool: 'file_preprocessing' },
    { tool: 'load_skill', resultContains: 'media-translation' },
    {
      tool: 'choose_file_output',
      handler: () => JSON.stringify({ selected: 'Voice-over' }),
    },
    { tool: 'choose_voice_preset' },
    { tool: 'confirm_action' },
    { tool: 'start_voiceover_translation_workflow' },
  ],
}
