import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'

function batchTxtScenario(count: number): FlowScenario {
  const preprocessedFileIds: string[] = []

  return {
    name: `Batch document translation (${count}x .txt → EN→RU)`,
    message: 'translate',
    files: loadScenarioFiles(import.meta.url).slice(0, count),
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
      { tool: 'load_skill', resultContains: 'simple-ai-translation' },
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

export const batchTxt10 = batchTxtScenario(10)
export const batchTxt20 = batchTxtScenario(20)
export const batchTxt50 = batchTxtScenario(50)
