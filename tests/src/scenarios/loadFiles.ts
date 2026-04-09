import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FileInput } from '../drive'

const MIME_BY_EXT: Record<string, string> = {
  '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt',
  '.ass': 'text/x-ssa',
  '.ssa': 'text/x-ssa',
  '.sbv': 'text/x-sbv',
  '.sub': 'text/x-sub',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.md': 'text/markdown',
  '.po': 'text/x-gettext-translation',
  '.yaml': 'application/x-yaml',
  '.yml': 'application/x-yaml',
  '.resx': 'application/xml',
  '.properties': 'text/x-java-properties',
  '.strings': 'text/plain',
}

/**
 * Reads all files from a `files/` subdirectory next to the calling module
 * and returns them as `FileInput[]` with MIME types inferred from extensions.
 *
 * Usage inside a scenario file:
 * ```ts
 * const files = loadScenarioFiles(import.meta.url)
 * ```
 */
export function loadScenarioFiles(importMetaUrl: string): FileInput[] {
  const dir = path.resolve(path.dirname(fileURLToPath(importMetaUrl)), 'files')
  return loadFilesFromDir(dir)
}
export function loadFilesFromDir(dir: string): FileInput[] {

  if (!fs.existsSync(dir)) {
    return []
  }

  const entries = fs.readdirSync(dir).filter((f) => {
    if (f.startsWith('.')) return false
    const full = path.join(dir, f)
    return fs.statSync(full).isFile()
  })

  return entries.map((name) => {
    const ext = path.extname(name).toLowerCase()
    const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream'
    return { path: path.join(dir, name), mimeType }
  })
}
