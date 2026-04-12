import type { ToolDefinition } from './types'

export const singleSelect: ToolDefinition = {
  name: 'select_single_option',
  description:
    'Tool for asking the user to select exactly one option from a list. Use this when only a single choice is allowed — for example picking a language, category, or mode. Returns the selected option string.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'A clear prompt explaining what the user is selecting',
      },
      searchPlaceholder: {
        type: 'string',
        description:
          'Placeholder text for the search input. Only shown when there are more than 5 options.',
      },
      options: {
        type: 'array',
        description: 'Options the user can choose from (radio buttons).',
        items: { type: 'string' },
      },
    },
    required: ['title', 'options'],
  },
}
