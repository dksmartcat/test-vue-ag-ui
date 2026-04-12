import type { ToolDefinition } from './types'

export const confirmAction: ToolDefinition = {
  name: 'confirm_action',
  description:
    "Tool for asking the user to confirm or adjust a proposed action plan. Displays a summary card with description and structured sections. The user can either confirm to proceed or request adjustments. Returns the user's decision.",
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
