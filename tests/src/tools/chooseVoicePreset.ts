import type { ToolDefinition } from './types'

export const chooseVoicePreset: ToolDefinition = {
  name: 'choose_voice_preset',
  description:
    'Tool for letting the user select a voice preset for text-to-speech. Displays available voice presets for a given language, grouped by tone. The user can preview voices before selecting. ' +
    'Shows the user a single-choice picker and a free-text input. Returns any subset of the following fields (only populated ones are included): ' +
    '`voicePresetId` — the preset ID the user picked from the list; ' +
    "`userMessage` — free text the user typed alongside or instead of picking. This is the user's reply in their own words — treat it the same way you treat any user message in the conversation.",
  parameters: {
    type: 'object',
    properties: {
      languageTag: {
        type: 'string',
        description: "Language IETF BCP 47 tag to load available voice presets for (e.g. 'pt-BR').",
      },
    },
    required: ['languageTag'],
  },
}
