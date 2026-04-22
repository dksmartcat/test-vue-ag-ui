import type { ToolDefinition } from './types'

export const displayWizardFallback: ToolDefinition = {
  name: 'display_wizard_fallback',
  description:
    'Show a wizard fallback card in the chat when package translation cannot continue in the assistant. ' +
    'The card includes a short explanation and a button that opens the matching project creation wizard. ' +
    'Use variant generic_document for standard document/file translation (including generic archives). ' +
    'Use variant course for SCORM or other course packages.',
  parameters: {
    type: 'object',
    properties: {
      variant: {
        type: 'string',
        enum: ['generic_document', 'course'],
        description:
          'generic_document: document translation wizard. course: translate a course (e.g. SCORM) wizard.',
      },
    },
    required: ['variant'],
  },
}
