import type { ToolDefinition } from './types'

export const singleSelect: ToolDefinition = {
  name: 'select_single_option',
  description:
    'Tool for asking the user to select exactly one option from a list. Use this when only a single choice is allowed — for example picking a language, category, or mode. ' +
    'Shows the user a single-choice picker and a free-text input. Returns one of the following fields: ' +
    '`selected` — the option the user picked from the list; ' +
    "`userMessage` — free text the user typed instead of picking. This is the user's reply in their own words — treat it as a regular user message in the conversation, interpreted in the context given by `title`.",
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
