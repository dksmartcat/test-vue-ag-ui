import type { ToolEntry } from './types'

export const chooseSubtitlesParameters: ToolEntry = {
  definition: {
    name: 'choose_subtitles_parameters',
    description:
      'Tool for letting the user configure subtitle parameters such as characters per line, lines per cue, and characters per second. Returns the configured values.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  handler: () =>
    JSON.stringify({ maxCharactersPerLine: 42, maxLinesPerCue: 2, maxCps: 25 }),
}
