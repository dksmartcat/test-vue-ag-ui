import type { ToolDefinition } from './types'

export const chooseAssets: ToolDefinition = {
  name: 'choose_assets_to_translate',
  description:
    'Tool for letting the user choose which assets to translate from package. Applicable only for files with packageId. Returns a JSON object { "selectedAssetsIds": string[] }. An empty array means no any assets have been selected.',
  parameters: {
    type: 'object',
    properties: {
      packageId: { type: 'string', description: 'GUID of the package' },
      driveFileId: { type: 'string', description: 'GUID of the drive file' },
      operationId: {
        type: 'string',
        description: 'GUID of the asset extraction operation',
      },
      fileName: {
        type: 'string',
        description: 'Display name of the root file',
      },
    },
    required: ['packageId', 'driveFileId', 'operationId', 'fileName'],
  },
}
