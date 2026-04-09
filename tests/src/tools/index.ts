import type { ToolDefinition, ToolHandler, ToolEntry } from './types'

import { chooseSourceLanguage } from './chooseSourceLanguage'
import { chooseTargetLanguage } from './chooseTargetLanguage'
import { confirmAction } from './confirmAction'
import { displayProject } from './displayProject'
import { singleSelect } from './singleSelect'
import { multiSelect } from './multiSelect'
import { multiInput } from './multiInput'
import { chooseFileOutput } from './chooseFileOutput'
import { chooseVoicePreset } from './chooseVoicePreset'
import { chooseSubtitlesParameters } from './chooseSubtitlesParameters'
import { chooseTemplate } from './chooseTemplate'
import { chooseAssets } from './chooseAssets'

export type { ToolDefinition, ToolHandler, ToolEntry }

const ALL_TOOLS: ToolEntry[] = [
  chooseSourceLanguage,
  chooseTargetLanguage,
  confirmAction,
  displayProject,
  singleSelect,
  multiSelect,
  multiInput,
  chooseFileOutput,
  chooseVoicePreset,
  chooseSubtitlesParameters,
  chooseTemplate,
  chooseAssets,
]

export const TOOL_DEFS: ToolDefinition[] = ALL_TOOLS.map((t) => t.definition)

export const TOOL_HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.definition.name, t.handler]),
)

export {
  chooseSourceLanguage,
  chooseTargetLanguage,
  confirmAction,
  displayProject,
  singleSelect,
  multiSelect,
  multiInput,
  chooseFileOutput,
  chooseVoicePreset,
  chooseSubtitlesParameters,
  chooseTemplate,
  chooseAssets,
}
