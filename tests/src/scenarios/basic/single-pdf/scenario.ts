import type { ClassicUserConfig, ExpectedScenario } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'
import {
  sourceEn,
  targetRu,
  confirm,
  displayed,
} from '../../../tools/handlers'

export const singlePdfUser: ClassicUserConfig = {
  name: 'Single PDF translation (.pdf -> EN->RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  handlers: {
    choose_source_language: sourceEn,
    choose_target_language: targetRu,
    confirm_action: confirm,
    display_project: displayed,
  },
  maxRounds: 9,
  maxTextMessages: 4,
}

export const singlePdfExpected: ExpectedScenario = {
  optionalTools: ['handoff_to_'],
  steps: [
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
    { tool: 'file_preprocessing' },
    { tool: 'load_skill', resultContains: 'pdf-translation', optional: true },
    { tool: 'confirm_action' },
    { tool: 'start_document_translation_workflow' },
    { tool: 'await_project_creation' },
    { tool: 'await_auto_translation' },
    { tool: 'display_project' },
  ],
}
