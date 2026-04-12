import type { ToolDefinition, ToolHandler } from './types'

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

export type { ToolDefinition, ToolHandler }

export const TOOL_DEFS: ToolDefinition[] = [
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
