import type { ToolEntry } from './types'

export const chooseTargetLanguage: ToolEntry = {
  definition: {
    name: 'choose_target_language',
    description:
      "REQUIRED tool for asking the user to select one or more target languages. Use this when you need to know which languages the content should be translated into. Returns tags array of selected languages in IETF BCP 47 format (e.g., 'en-US', 'ru-RU').",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  handler: () => JSON.stringify({ targetLanguageTags: ['ru'] }),
}
