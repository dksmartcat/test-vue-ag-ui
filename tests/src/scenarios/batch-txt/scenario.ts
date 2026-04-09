import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'

export const batchTxt: FlowScenario = {
  name: 'Batch document translation (20x .txt → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  optionalTools: ['handoff_to_'],
  steps: [
    { tool: 'choose_source_language' },
    { tool: 'choose_target_language' },
    {
      count: 20,
      block: [
        { tool: 'file_preprocessing' },
        { tool: 'choose_assets_to_translate', optional: true },
      ],
    },
    { tool: 'load_skill', resultContains: 'simple-ai-translation' },
    { tool: 'confirm_action' },
    { tool: 'start_document_translation_workflow' },
  ],
}
