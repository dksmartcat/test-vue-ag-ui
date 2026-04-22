import type { ToolDefinition } from './types'

export const displayProject: ToolDefinition = {
  name: 'display_project',
  description:
    'Display a project card in the chat with a link to open the project. Use this to show the user a quick link to their translation project.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Project title to display' },
      projectId: { type: 'string', description: 'Project ID used to build the project URL' },
      folderId: {
        type: 'string',
        description:
          'Optional Drive folder associated with this project. When supplied, the user gets an extra way to open that folder in Drive.',
      },
    },
    required: ['title', 'projectId'],
  },
}
