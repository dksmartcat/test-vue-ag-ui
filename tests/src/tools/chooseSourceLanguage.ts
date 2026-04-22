import type { ToolDefinition } from './types'

export const chooseSourceLanguage: ToolDefinition = {
  name: 'choose_source_language',
  description:
    'REQUIRED tool for asking the user to select a single source language. Use this when you need to know the original language of the content. ' +
    'Shows the user a language picker and a free-text input. Returns any subset of the following fields (only populated ones are included): ' +
    "`sourceLanguageTag` — the language the user picked, as a BCP 47 tag (e.g. 'en-US'); " +
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
