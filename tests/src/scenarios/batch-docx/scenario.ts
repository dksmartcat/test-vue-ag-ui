import * as path from 'node:path'
import type { FlowScenario } from '../../scenario'
import { loadFilesFromDir } from '../loadFiles'

const DOCX_OUTPUT_DIR = path.resolve(__dirname, '../../generators/docx/output')

function loadDocx(count: number) {
  return loadFilesFromDir(DOCX_OUTPUT_DIR).slice(0, count)
}

function batchDocxScenario(count: number): FlowScenario {
  return {
    name: `Batch document translation (${count}x .docx → EN→RU)`,
    message: 'translate',
    files: loadDocx(count),
    optionalTools: ['handoff_to_'],
    steps: [
      { tool: 'load_skill', optional: true },
      { tool: 'choose_source_language' },
      { tool: 'load_skill', optional: true },
      { tool: 'choose_target_language' },
      {
        count,
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
}

export const batchDocx10 = batchDocxScenario(10)
export const batchDocx20 = batchDocxScenario(20)
export const batchDocx50 = batchDocxScenario(50)
