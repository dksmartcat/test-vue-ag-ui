import type { ToolEntry } from './types'

export const multiSelect: ToolEntry = {
  definition: {
    name: 'select_multiple_options',
    description:
      'Tool for asking the user to select one or more options from a list. Use this when multiple selections are allowed — for example picking several categories, tags, or features. Returns all selected option strings.',
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
  },
  handler: (args) => {
    const options = args.options as string[] | undefined
    return JSON.stringify({ selected: options ?? [] })
  },
}
