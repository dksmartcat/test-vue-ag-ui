import type { ToolDefinition } from './types'

export const confirmAction: ToolDefinition = {
  name: 'confirm_action',
  description:
    'Ask the user to confirm or cancel launching a translation workflow. ' +
    'The user reply must be JSON `{"confirmed": true}` to proceed or ' +
    '`{"confirmed": false}` to cancel / request adjustments. ' +
    'This matches the real frontend contract — any other shape is ignored ' +
    'by the backend and the workflow never starts.',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'A brief description of the proposed action plan',
      },
      sections: {
        type: 'array',
        description: 'Structured sections with details about the plan',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Section heading' },
            items: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of details in this section',
            },
          },
          required: ['title', 'items'],
        },
      },
    },
    required: ['description'],
  },
}
