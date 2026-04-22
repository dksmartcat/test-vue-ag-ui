import type { ToolDefinition } from './types'

export const chooseTemplate: ToolDefinition = {
  name: 'choose_template',
  description:
    'Tool for letting the user select a project template. Displays available templates filtered by source and target languages. ' +
    'Shows the user a single-choice picker and a free-text input. Returns any subset of the following fields (only populated ones are included): ' +
    '`selectedCustomTemplateId` — the template ID the user picked from the list; ' +
    "`userMessage` — free text the user typed alongside or instead of picking. This is the user's reply in their own words — treat it the same way you treat any user message in the conversation.",
  parameters: {
    type: 'object',
    properties: {
      sourceLanguageTags: {
        type: 'array',
        description: "Source language IETF BCP 47 tags to filter templates by (e.g. ['en-US']).",
        items: { type: 'string' },
      },
      targetLanguageTags: {
        type: 'array',
        description:
          "Target language IETF BCP 47 tags to filter templates by (e.g. ['pt-BR', 'es-ES']).",
        items: { type: 'string' },
      },
    },
    required: ['sourceLanguageTags', 'targetLanguageTags'],
  },
}
