import type { ToolDefinition } from './types'

export const chooseTargetLanguage: ToolDefinition = {
  name: 'choose_target_language',
  description:
    'REQUIRED tool for asking the user to select one or more target languages. Use this when you need to know which languages the content should be translated into. ' +
    'Shows the user a language picker and a free-text input. Returns any subset of the following fields (only populated ones are included): ' +
    "`targetLanguageTags` — the languages the user picked, as BCP 47 tags (e.g. ['pt-BR', 'es-ES']); " +
    "`userMessage` — free text the user typed alongside or instead of picking. This is the user's reply in their own words — treat it the same way you treat any user message in the conversation.",
  parameters: {
    type: 'object',
    properties: {
      allowedLanguageTags: {
        type: 'array',
        description:
          'Optional list of IETF BCP 47 language tags to restrict the selection. When provided, only these languages are shown.',
        items: { type: 'string' },
      },
    },
    required: [],
  },
}
