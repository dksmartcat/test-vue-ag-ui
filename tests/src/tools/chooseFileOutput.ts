import type { ToolDefinition } from './types'

export const chooseFileOutput: ToolDefinition = {
  name: 'choose_file_output',
  description:
    'REQUIRED tool for asking the user to choose the desired file output format. You MUST call this tool when the user needs to decide between Voice-over, Subtitles, or Subtitles + voice-over output. ' +
    'Shows the user a single-choice picker and a free-text input. Returns one of the following fields: ' +
    "`fileOutputFormat` — one of 'Voice-over' | 'Subtitles' | 'Subtitles + voice-over', present when the user picked from the list; " +
    "`userMessage` — free text the user typed instead of picking.",
  parameters: { type: 'object', properties: {}, required: [] },
}
