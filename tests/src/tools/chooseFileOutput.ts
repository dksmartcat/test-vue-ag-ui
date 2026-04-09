import type { ToolEntry } from './types'

export const chooseFileOutput: ToolEntry = {
  definition: {
    name: 'choose_file_output',
    description:
      'REQUIRED tool for asking the user to choose the desired file output format. You MUST call this tool when the user needs to decide between Voice-over, Subtitles, or Subtitles + voice-over output. Returns the selected option and any additional information provided by the user.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  handler: () => JSON.stringify({ selected: 'Subtitles only' }),
}
