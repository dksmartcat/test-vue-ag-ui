import type { ToolHandler } from './types'

// ---------------------------------------------------------------------------
// Source language
// ---------------------------------------------------------------------------

export const sourceEn: ToolHandler = () =>
  JSON.stringify({ sourceLanguageTag: 'en' })

export const sourceRu: ToolHandler = () =>
  JSON.stringify({ sourceLanguageTag: 'ru' })

// ---------------------------------------------------------------------------
// Target language
// ---------------------------------------------------------------------------

export const targetRu: ToolHandler = () =>
  JSON.stringify({ targetLanguageTags: ['ru'] })

export const targetEn: ToolHandler = () =>
  JSON.stringify({ targetLanguageTags: ['en'] })

// ---------------------------------------------------------------------------
// Confirm / display
// ---------------------------------------------------------------------------

export const confirm: ToolHandler = () =>
  JSON.stringify({ action: 'confirm' })

export const displayed: ToolHandler = () => 'displayed'

// ---------------------------------------------------------------------------
// File output
// ---------------------------------------------------------------------------

export const subtitlesOnly: ToolHandler = () =>
  JSON.stringify({ fileOutputFormat: 'Subtitles' })

export const voiceover: ToolHandler = () =>
  JSON.stringify({ fileOutputFormat: 'Voice-over' })

export const subtitlesAndVoiceover: ToolHandler = () =>
  JSON.stringify({ fileOutputFormat: 'Subtitles + voice-over' })

// ---------------------------------------------------------------------------
// Voice preset
// ---------------------------------------------------------------------------

export const defaultVoicePreset: ToolHandler = () =>
  JSON.stringify({ voicePresetId: 'default-preset' })

// ---------------------------------------------------------------------------
// Subtitles parameters
// ---------------------------------------------------------------------------

export const defaultSubtitlesParams: ToolHandler = () =>
  JSON.stringify({
    selected: ['Max characters per line: 42', 'Max lines per cue: 2', 'Max CPS: 25'],
  })

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export const defaultTemplate: ToolHandler = () =>
  JSON.stringify({ selectedCustomTemplateId: 'default-template' })

// ---------------------------------------------------------------------------
// Workflow stages
// ---------------------------------------------------------------------------

/** Pick the default stage set from the tool args. */
export const defaultWorkflowStages: ToolHandler = (args) => {
  const stagesSets = args.stagesSets as Array<{ stages: string[]; isDefault: boolean }> | undefined
  const def = stagesSets?.find((s) => s.isDefault) ?? stagesSets?.[0]
  return JSON.stringify({ selectedStages: def?.stages ?? ['AiTranslation'] })
}

/** Pick the minimal "AI Translation" stage set — the one with stages = ['AiTranslation']. */
export const aiTranslationStages: ToolHandler = (args) => {
  const stagesSets = args.stagesSets as Array<{ stages: string[]; isDefault: boolean }> | undefined
  const match = stagesSets?.find(
    (s) => s.stages.length === 1 && s.stages[0] === 'AiTranslation',
  )
  return JSON.stringify({ selectedStages: match?.stages ?? ['AiTranslation'] })
}

/** Reply with only free-text userMessage — as if the user typed in "something else" and didn't pick a stage set. */
export const workflowUserMessage =
  (message: string): ToolHandler =>
  () =>
    JSON.stringify({ userMessage: message })

// ---------------------------------------------------------------------------
// Generic selects
// ---------------------------------------------------------------------------

export const selectFirst: ToolHandler = (args) => {
  const options = args.options as string[] | undefined
  return JSON.stringify({ selected: options?.[0] ?? 'option1' })
}

export const selectAll: ToolHandler = (args) => {
  const options = args.options as string[] | undefined
  return JSON.stringify({ selected: options ?? [] })
}

// ---------------------------------------------------------------------------
// Multi input
// ---------------------------------------------------------------------------

export const acceptDefaults: ToolHandler = (args) => {
  const options = args.options as Array<{ label: string; defaultValue?: string }> | undefined
  const selected = (options ?? []).map((o) => `${o.label}: ${o.defaultValue ?? 'default'}`)
  return JSON.stringify({ selected })
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const selectAllAssets: ToolHandler = (args) => {
  const packageId = args.packageId as string
  const driveFileId = args.driveFileId as string
  return JSON.stringify({ driveFileId, packageId, selectedAssetsIds: ['asset-1', 'asset-2'] })
}

export const selectNoAssets: ToolHandler = (args) => {
  const packageId = args.packageId as string
  const driveFileId = args.driveFileId as string
  return JSON.stringify({ driveFileId, packageId, selectedAssetsIds: [] })
}

// ---------------------------------------------------------------------------
// Factory: userMessage — free-text reply typed into "something else" field,
// equivalent to a regular chat message. Use with any picker tool.
// ---------------------------------------------------------------------------

export const userMessage =
  (message: string): ToolHandler =>
  () =>
    JSON.stringify({ userMessage: message })
