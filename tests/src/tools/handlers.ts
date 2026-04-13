import type { ToolHandler } from './types'

// ---------------------------------------------------------------------------
// Source language
// ---------------------------------------------------------------------------

export const sourceEn: ToolHandler = () =>
  JSON.stringify({ sourceLanguageTag: ['en'] })

export const sourceRu: ToolHandler = () =>
  JSON.stringify({ sourceLanguageTag: ['ru'] })

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
  JSON.stringify({ selected: ['Subtitles only'] })

export const voiceover: ToolHandler = () =>
  JSON.stringify({ selected: ['Voice-over'] })

export const subtitlesAndVoiceover: ToolHandler = () =>
  JSON.stringify({ selected: ['Subtitles + voice-over'] })

// ---------------------------------------------------------------------------
// Voice preset
// ---------------------------------------------------------------------------

export const defaultVoicePreset: ToolHandler = () =>
  JSON.stringify({ selected: ['default-preset'] })

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
  JSON.stringify({ selected: ['default-template'] })

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
