import type { ToolDefinition } from './types'

export const chooseSubtitlesParameters: ToolDefinition = {
  name: 'choose_subtitles_parameters',
  description:
    'Tool for letting the user configure subtitle parameters such as characters per line, lines per cue, and characters per second. ' +
    'Returns any subset of the following fields (only populated ones are included): ' +
    "`selected` — an array of `'<label>: <value>'` strings with the numeric parameters; " +
    "`userMessage` — free text the user typed alongside the parameters. This is the user's reply in their own words — treat it the same way you treat any user message in the conversation.",
  parameters: { type: 'object', properties: {}, required: [] },
}
