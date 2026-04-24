import type { ToolDefinition } from './types'

export const chooseWorkflowStages: ToolDefinition = {
  name: 'choose_workflow_stages',
  description:
    'Tool for letting the user select a stage set. Displays available stage sets and returns the selected stages. If the user prefers a custom template, returns a custom template selection indicator. ' +
    'Shows the user a single-choice picker and a free-text input. Returns any subset of the following fields (only populated ones are included): ' +
    '`selectedStages` — an array of stage names when the user picked a predefined stage set; ' +
    '`selectedCustomTemplateId` — a template ID when the user picked a custom template option; ' +
    "`userMessage` — free text the user typed alongside the choice.",
  parameters: {
    type: 'object',
    properties: {
      sourceLanguageTag: {
        type: 'string',
        description: "Source language IETF BCP 47 tag (e.g. 'en-US').",
      },
      targetLanguageTags: {
        type: 'array',
        description: "Target language IETF BCP 47 tags (e.g. ['ru-RU', 'ro']).",
        items: { type: 'string' },
      },
      stagesSets: {
        type: 'array',
        description: 'Available stage sets to choose from.',
        items: {
          type: 'object',
          properties: {
            stages: {
              type: 'array',
              description: "Ordered array of stages (e.g. ['AiTranslation', 'TranslationReview']).",
              items: { type: 'string' },
            },
            isDefault: {
              type: 'boolean',
              description: 'Whether this stage set is the default selection.',
            },
          },
          required: ['stages', 'isDefault'],
        },
      },
    },
    required: ['sourceLanguageTag', 'targetLanguageTags', 'stagesSets'],
  },
}
