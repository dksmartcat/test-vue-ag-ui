import type { ToolEntry } from './types'

export const chooseVoicePreset: ToolEntry = {
  definition: {
    name: 'choose_voice_preset',
    description:
      'Tool for letting the user select a voice preset for text-to-speech. Displays available voice presets for a given language, grouped by tone. The user can preview voices before selecting. Returns the selected voice preset ID.',
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
  },
  handler: () => JSON.stringify({ voicePresetId: 'default-preset' }),
}
