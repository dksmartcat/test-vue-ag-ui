import * as path from 'node:path'
import type { UserConfig, ExpectedScenario } from '../../scenario'
import { loadFilesFromDir } from '../loadFiles'
import {
  sourceEn,
  targetRu,
  confirm,
  displayed,
  selectAllAssets,
} from '../../tools/handlers'

const DOCX_OUTPUT_DIR = path.resolve(__dirname, '../../generators/docx/output')

function loadDocx(count: number) {
  return loadFilesFromDir(DOCX_OUTPUT_DIR).slice(0, count)
}

export function batchDocxUser(count: number): UserConfig {
  return {
    name: `Batch document translation (${count}x .docx -> EN->RU)`,
    message: 'translate',
    files: loadDocx(count),
    handlers: {
      choose_source_language: sourceEn,
      choose_target_language: targetRu,
      confirm_action: confirm,
      display_project: displayed,
      choose_assets_to_translate: selectAllAssets,
    },
  }
}

export function batchDocxExpected(count: number): ExpectedScenario {
  const preprocessedFileIds: string[] = []

  return {
    optionalTools: ['handoff_to_'],
    steps: [
      { tool: 'load_skill', optional: true },
      { tool: 'choose_source_language' },
      { tool: 'load_skill', optional: true },
      { tool: 'choose_target_language' },
      {
        count,
        block: [
          {
            tool: 'file_preprocessing',
            check(_args, result) {
              if (!result) return
              const outer = JSON.parse(result) as string | { output?: { driveFileId?: string } }
              const parsed = typeof outer === 'string'
                ? (JSON.parse(outer) as { output?: { driveFileId?: string } })
                : outer
              if (parsed.output?.driveFileId) {
                preprocessedFileIds.push(parsed.output.driveFileId)
              }
            },
          },
          { tool: 'choose_assets_to_translate', optional: true },
        ],
      },
      { tool: 'load_skill', resultContains: 'simple-ai-translation', optional: true },
      { tool: 'confirm_action' },
      {
        tool: 'start_document_translation_workflow',
        check(args) {
          const fileIds = args.fileIds as string[] | undefined
          if (!fileIds) throw new Error('args.fileIds is missing')

          const missing = preprocessedFileIds.filter((id) => !fileIds.includes(id))
          if (missing.length > 0) {
            throw new Error(
              `${missing.length} preprocessed file(s) missing from workflow args: ${missing.slice(0, 5).join(', ')}`,
            )
          }
        },
      },
      { tool: 'await_project_creation' },
      { tool: 'await_auto_translation' },
      { tool: 'display_project' },
    ],
  }
}
