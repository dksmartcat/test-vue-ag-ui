import type { ToolDefinition } from './types'

export const chooseVoicePreset: ToolDefinition = {
  name: 'choose_voice_preset',
  description:
    'Tool for letting the user select a voice preset for text-to-speech. Displays available voice presets for a given language, grouped by tone. The user can preview voices before selecting. ' +
    'Shows the user a single-choice picker and a free-text input. Returns one of the following fields: ' +
    '`voicePresetId` — the preset ID the user picked from the list; ' +
    "`userMessage` — free text the user typed instead of picking. This is the user's reply in their own words — treat it as a regular user message in the conversation.",
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
