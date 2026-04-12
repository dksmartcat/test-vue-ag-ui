import type { ToolDefinition } from './types'

const assetItemSchema = {
  type: 'object',
  properties: {
    assetId: { type: 'string', description: 'Unique identifier for the asset' },
    assetType: {
      type: 'string',
      enum: ['Image', 'Audio', 'Video', 'Document'],
      description: 'Category of the asset',
    },
    assetName: { type: 'string', description: 'Display name of the asset' },
    assetPreviewUrl: { type: 'string', description: 'URL of the asset preview image' },
  },
  required: ['assetId', 'assetType', 'assetName'],
}

export const chooseAssets: ToolDefinition = {
  name: 'choose_assets_to_translate',
  description:
    'Tool for letting the user choose which assets to translate from package. Applicable only for files with packageId. Returns a JSON object { "selectedAssetsIds": string[] }. An empty array means no any assets have been selected.',
  parameters: {
    type: 'object',
    properties: {
      packageId: { type: 'string', description: 'GUID of the package' },
      driveFileId: { type: 'string', description: 'GUID of the drive file' },
      assets: {
        type: 'array',
        description: 'Array of assets available for selection',
        items: assetItemSchema,
      },
    },
    required: ['packageId', 'driveFileId', 'assets'],
  },
}
