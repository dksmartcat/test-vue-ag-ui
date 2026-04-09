/**
 * Drive file upload & cleanup helpers for integration tests.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DRIVE_URL, DRIVE_APP_ID, DRIVE_SECRET_KEY, WORKSPACE_ID, USER_ID } from './config'

interface DriveDirectoryInfo {
  directoryId: string
  name: string
}

export interface DriveFileInfo {
  fileId: string
  name: string
  mime: string
}

function driveAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${DRIVE_APP_ID}:${DRIVE_SECRET_KEY}`).toString('base64')
}

async function createDirectory(directoryName: string): Promise<DriveDirectoryInfo> {
  const res = await fetch(`${DRIVE_URL}/api/internal/v1/directories/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: driveAuthHeader() },
    body: JSON.stringify({ workspaceId: WORKSPACE_ID, directoryName, userId: USER_ID }),
  })
  if (!res.ok) throw new Error(`CreateDirectory failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as DriveDirectoryInfo
}

async function uploadFile(parentDirectoryId: string, filePath: string): Promise<DriveFileInfo> {
  const fileName = path.basename(filePath)
  const fileBuffer = fs.readFileSync(filePath)
  const blob = new Blob([fileBuffer])

  const form = new FormData()
  form.append('File', blob, fileName)

  const params = new URLSearchParams({
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    parentDirectoryId,
    overwrite: 'false',
  })

  const res = await fetch(`${DRIVE_URL}/api/internal/v1/files/upload?${params}`, {
    method: 'POST',
    headers: { Authorization: driveAuthHeader() },
    body: form,
  })
  if (!res.ok) throw new Error(`UploadFile failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as DriveFileInfo
}

export async function cleanupTestDirectories(): Promise<void> {
  console.log('Cleaning up old test directories...')
  let batchKey: string | null = null

  do {
    const body: Record<string, unknown> = {
      workspaceId: WORKSPACE_ID,
      query: '',
      searchOption: 0,
    }
    if (batchKey) body.batchKey = batchKey

    const res = await fetch(`${DRIVE_URL}/api/internal/v1/directories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: driveAuthHeader() },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.warn(`  SearchDirectories failed: ${res.status} — skipping cleanup`)
      return
    }

    const batch = (await res.json()) as { items: DriveDirectoryInfo[]; nextBatchKey: string | null }

    for (const dir of batch.items) {
      const delRes = await fetch(
        `${DRIVE_URL}/api/internal/v1/directories/${dir.directoryId}?userId=${USER_ID}`,
        { method: 'DELETE', headers: { Authorization: driveAuthHeader() } },
      )
      console.log(`  Deleted directory ${dir.name} (${dir.directoryId}): ${delRes.status}`)
    }

    batchKey = batch.nextBatchKey
  } while (batchKey)
}

export interface FileInput {
  path: string
  mimeType: string
}

export async function uploadTestFiles(
  files: FileInput[],
): Promise<Array<DriveFileInfo & { mimeType: string }>> {
  for (const f of files) {
    if (!fs.existsSync(f.path)) throw new Error(`Test file not found: ${f.path}`)
  }

  await cleanupTestDirectories()

  const dir = await createDirectory(`test-${Date.now()}`)
  console.log(`  Directory created: id=${dir.directoryId} name=${dir.name}`)

  const results: Array<DriveFileInfo & { mimeType: string }> = []
  for (const f of files) {
    const uploaded = await uploadFile(dir.directoryId, f.path)
    console.log(`  Uploaded: fileId=${uploaded.fileId} name=${uploaded.name}`)
    results.push({ ...uploaded, mimeType: f.mimeType })
  }

  return results
}
