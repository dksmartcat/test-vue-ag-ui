export interface TextElement {
  type: 'text'
  value: string
}

export interface AssetElement {
  type: 'asset'
  path: string
  width?: number
  height?: number
}

export type DocElement = TextElement | AssetElement
