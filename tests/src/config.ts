/**
 * Shared configuration for integration tests.
 * TOKEN must be a valid JWT — update before running.
 */

export const SERVER_URL = 'http://localhost:7711/api/ai-agents/agent'
export const TOKEN = ''
export const DRIVE_URL = 'http://file-management-service-web.stage-feature-4.k8s.ya.sc.local'
export const DRIVE_APP_ID = 'aiAgents'
export const DRIVE_SECRET_KEY = ''

function parseJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.')
  if (parts.length < 2) throw new Error('Invalid JWT')
  const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as Record<string, unknown>
}

const JWT_CLAIMS = parseJwtPayload(TOKEN)
export const WORKSPACE_ID = JWT_CLAIMS.accountId as string
export const USER_ID = JWT_CLAIMS.userId as string
