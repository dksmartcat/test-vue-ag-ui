import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
} from 'docx'
import type { DocElement } from './types'

function imageDimensions(
  el: { width?: number; height?: number },
): { width: number; height: number } {
  return {
    width: el.width ?? 600,
    height: el.height ?? 400,
  }
}

function buildChildren(elements: DocElement[]): Paragraph[] {
  return elements.map((el) => {
    switch (el.type) {
      case 'text':
        return new Paragraph({
          children: [new TextRun({ text: el.value, size: 24 })],
        })

      case 'asset': {
        const absPath = path.resolve(el.path)
        if (!fs.existsSync(absPath)) {
          throw new Error(`Asset not found: ${absPath}`)
        }
        const data = fs.readFileSync(absPath)
        const ext = path.extname(absPath).toLowerCase()
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
        const dims = imageDimensions(el)

        return new Paragraph({
          children: [
            new ImageRun({
              data,
              transformation: dims,
              type: mime === 'image/png' ? 'png' : 'jpg',
            }),
          ],
        })
      }
    }
  })
}

export interface GenerateDocxOptions {
  title?: string
  elements: DocElement[]
  outputPath: string
}

export async function generateDocx(options: GenerateDocxOptions): Promise<string> {
  const sections: Paragraph[] = []

  if (options.title) {
    sections.push(
      new Paragraph({
        text: options.title,
        heading: HeadingLevel.HEADING_1,
      }),
    )
  }

  sections.push(...buildChildren(options.elements))

  const doc = new Document({
    sections: [{ children: sections }],
  })

  const buffer = await Packer.toBuffer(doc)
  const outputPath = path.resolve(options.outputPath)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, buffer)

  return outputPath
}
