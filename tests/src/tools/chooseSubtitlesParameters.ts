import type { ToolDefinition } from './types'

export const chooseSubtitlesParameters: ToolDefinition = {
  name: 'choose_subtitles_parameters',
  description:
    'Tool for letting the user configure subtitle parameters such as characters per line, lines per cue, and characters per second. Returns the configured values.',
  parameters: { type: 'object', properties: {}, required: [] },
}
