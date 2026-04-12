import type { ToolDefinition } from './types'

export const chooseTemplate: ToolDefinition = {
  name: 'choose_template',
  description:
    'Tool for letting the user select a project template. Displays available templates filtered by source and target languages. Returns the selected template ID.',
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
