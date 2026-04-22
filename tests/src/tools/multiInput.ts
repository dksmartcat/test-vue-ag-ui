import type { ToolDefinition } from './types'

export const multiInput: ToolDefinition = {
  name: 'multi_input',
  description:
    'Tool for collecting multiple text inputs from the user at once. Each input has a label and an optional default value. Use this when you need several related values (e.g. parameters, settings) in a single step. ' +
    'Returns any subset of the following fields (only populated ones are included): ' +
    "`selected` — an array of `'<label>: <value>'` strings for the inputs the user filled; " +
    "`userMessage` — free text the user typed alongside the inputs. This is the user's reply in their own words — treat it the same way you treat any user message in the conversation.",
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
}
