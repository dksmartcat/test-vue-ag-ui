import type { ToolDefinition } from './types'

export const chooseSourceLanguage: ToolDefinition = {
  name: 'choose_source_language',
  description:
    "REQUIRED tool for asking the user to select a single source language. Use this when you need to know the original language of the content. Returns the tag of selected language in IETF BCP 47 format (e.g., 'en-US', 'ru-RU').",
  parameters: { type: 'object', properties: {}, required: [] },
}
