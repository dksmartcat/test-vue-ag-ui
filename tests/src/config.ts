/**
 * Shared configuration for integration tests.
 *
 * Values are loaded from a `.env` file at this package root (next to
 * `package.json`). If `.env` is missing, existing process environment
 * variables are used instead. Copy `.env.template` → `.env` and fill in
 * the required fields before running tests.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Load .env if present. Requires Node ^20.12 (satisfied by `engines`).
// ---------------------------------------------------------------------------

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

// ---------------------------------------------------------------------------
// Agent server
// ---------------------------------------------------------------------------

export const SERVER_URL = env('SERVER_URL', 'http://localhost:7711/api/ai-agents/agent')

/** JWT for the Smartcat user. Tests skip when empty. */
export const TOKEN = env('TOKEN')

// ---------------------------------------------------------------------------
// Smartcat Drive
// ---------------------------------------------------------------------------

export const DRIVE_URL = env(
  'DRIVE_URL',
  'http://file-management-service-web.stage-feature-4.k8s.ya.sc.local',
)
export const DRIVE_APP_ID = env('DRIVE_APP_ID', 'aiAgents')
export const DRIVE_SECRET_KEY = env('DRIVE_SECRET_KEY')

// ---------------------------------------------------------------------------
// AI User (LLM-driven test scenarios)
// ---------------------------------------------------------------------------

export const AI_USER_URL = env('AI_USER_URL', 'https://api.openai.com/v1/chat/completions')
export const AI_USER_API_KEY = env('AI_USER_API_KEY')
export const AI_USER_MODEL = env('AI_USER_MODEL', 'gpt-5.4')

// ---------------------------------------------------------------------------
// Derived from JWT (only if TOKEN is present).
// ---------------------------------------------------------------------------

function parseJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.')
  if (parts.length < 2) throw new Error('Invalid JWT')
  const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as Record<string, unknown>
}

const JWT_CLAIMS = TOKEN ? parseJwtPayload(TOKEN) : {}
export const WORKSPACE_ID = (JWT_CLAIMS.accountId as string | undefined) ?? ''
export const USER_ID = (JWT_CLAIMS.userId as string | undefined) ?? ''
