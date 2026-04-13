import type { UserConfig, ExpectedScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'
import {
  sourceEn,
  targetRu,
  confirm,
  displayed,
  selectAllAssets,
} from '../../tools/handlers'

export const mixedCategoriesUser: UserConfig = {
  name: 'Mixed categories (mp3+mp4+srt+pdf -> simple-ai-translation)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  handlers: {
    choose_source_language: sourceEn,
    choose_target_language: targetRu,
    confirm_action: confirm,
    display_project: displayed,
    choose_assets_to_translate: selectAllAssets,
  },
}

export const mixedCategoriesExpected: ExpectedScenario = {
  optionalTools: ['handoff_to_'],
  steps: [
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
    {
      count: 4,
      block: [
        { tool: 'file_preprocessing' },
        { tool: 'choose_assets_to_translate', optional: true },
      ],
    },
    { tool: 'load_skill', resultContains: 'simple-ai-translation', optional: true },
    { tool: 'confirm_action' },
    { tool: 'start_document_translation_workflow' },
    { tool: 'await_project_creation' },
    { tool: 'await_auto_translation' },
    { tool: 'display_project' },
  ],
}
