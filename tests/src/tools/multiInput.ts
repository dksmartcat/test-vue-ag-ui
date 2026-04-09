import type { ToolEntry } from './types'

export const multiInput: ToolEntry = {
  definition: {
    name: 'multi_input',
    description:
      'Tool for collecting multiple text inputs from the user at once. Each input has a label and an optional default value. Use this when you need several related values (e.g. parameters, settings) in a single step. Returns label-value pairs.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'A clear prompt explaining what the user is filling in',
        },
        options: {
          type: 'array',
          description: 'Input fields to display, each with a label and optional default value.',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Label for the input field' },
              defaultValue: { type: 'string', description: 'Pre-filled value for the input' },
            },
            required: ['label'],
          },
        },
      },
      required: ['title', 'options'],
    },
  },
  handler: (args) => {
    const options = args.options as Array<{ label: string; defaultValue?: string }> | undefined
    const values = (options ?? []).map((o) => ({
      label: o.label,
      value: o.defaultValue ?? 'default',
    }))
    return JSON.stringify({ values })
  },
}
