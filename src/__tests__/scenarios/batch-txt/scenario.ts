import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'

/**
 * 20 small .txt files → document translation workflow.
 */
export const batchTxt: FlowScenario = {
  name: 'Batch document translation (20x .txt → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  rounds: [
    { round: 1, steps: [{ tool: 'choose_source_language' }] },
    { round: 2, steps: [{ tool: 'choose_target_language' }] },
    {
      round: 3,
      steps: [
        { tool: 'file_preprocessing', count: 20 },
        { tool: 'load_skill', resultContains: 'simple-ai-translation' },
        { tool: 'confirm_action' },
      ],
    },
    { round: 4, steps: [{ tool: 'start_document_translation_workflow' }] },
  ],
}
