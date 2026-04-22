import type { ToolDefinition } from './types'

export const multiSelect: ToolDefinition = {
  name: 'select_multiple_options',
  description:
    'Tool for asking the user to select one or more options from a list. Use this when multiple selections are allowed — for example picking several categories, tags, or features. ' +
    'Shows the user a multi-choice picker and a free-text input. Returns any subset of the following fields (only populated ones are included): ' +
    '`selected` — the options the user picked from the list; ' +
    "`userMessage` — free text the user typed alongside or instead of picking. This is the user's reply in their own words — treat it the same way you treat any user message in the conversation, interpreted in the context given by `title`.",
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'A clear prompt explaining what the user is selecting',
      },
      options: {
        type: 'array',
        description: 'Options the user can choose from (checkboxes).',
        items: { type: 'string' },
      },
    },
    required: ['title', 'options'],
  },
}
