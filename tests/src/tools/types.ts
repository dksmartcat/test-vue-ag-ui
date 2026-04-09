export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ToolHandler = (args: Record<string, unknown>) => string

export interface ToolEntry {
  definition: ToolDefinition
  handler: ToolHandler
}
