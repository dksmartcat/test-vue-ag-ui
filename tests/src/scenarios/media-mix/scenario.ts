import type { FlowScenario } from '../../scenario'
import { loadScenarioFiles } from '../loadFiles'
import {
  sourceEn,
  targetRu,
  subtitlesOnly,
  defaultVoicePreset,
  defaultSubtitlesParams,
  confirm,
  displayed,
  selectAllAssets,
  selectFirst,
  selectAll,
} from '../../tools/handlers'

export const mediaMix: FlowScenario = {
  name: 'Media translation (mp3+mp4+srt → EN→RU)',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  optionalTools: ['handoff_to_', 'select_single_option', 'select_multiple_options'],
  handlers: {
    choose_source_language: sourceEn,
    choose_target_language: targetRu,
    choose_file_output: subtitlesOnly,
    choose_voice_preset: defaultVoicePreset,
    choose_subtitles_parameters: defaultSubtitlesParams,
    confirm_action: confirm,
    display_project: displayed,
    choose_assets_to_translate: selectAllAssets,
    select_single_option: selectFirst,
    select_multiple_options: selectAll,
  },
  steps: [
    { tool: 'load_skill', optional: true },
    { tool: 'choose_source_language' },
    { tool: 'load_skill', optional: true },
    { tool: 'choose_target_language' },
    {
      count: 3,
      block: [
        { tool: 'file_preprocessing' },
        { tool: 'choose_assets_to_translate', optional: true },
      ],
    },
    { tool: 'load_skill', resultContains: 'media-translation' },
    { tool: 'choose_file_output' },
    { tool: 'choose_voice_preset', optional: true },
    { tool: 'choose_subtitles_parameters', optional: true },
    { tool: 'confirm_action' },
    { tool: 'start_subtitles_translation_workflow' },
    { tool: 'await_project_creation' },
    { tool: 'await_auto_translation' },
    { tool: 'display_project' },
  ],
}
