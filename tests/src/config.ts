/**
 * Shared configuration for integration tests.
 * TOKEN must be a valid JWT — update before running.
 */

export const SERVER_URL = 'http://localhost:7711/api/ai-agents/agent'
export const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE1ODI2RDI5LTIzNzctNEUzNS04NkJDLTkzRjI0QTRGMzMxRSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJzbWFydGNhdCIsImlzcyI6InNtYXJ0Y2F0LXBsYXRmb3JtIiwidXNlcklkIjoiYmM5NjI4MWEtZGIzMi00YzRlLWFmODMtNDk1OTFkM2E2ZGQzIiwidXNlck5hbWUiOiJUZXN0IFRlc3QiLCJ1c2VyRW1haWwiOiJkLnNoaXJ5YWV2QHNtYXJ0Y2F0LmFpIiwiYWNjb3VudElkIjoiYzJiNWZmNjEtYTNmNy00NmNiLTgwYTMtOGUzMDU2OTliNmI2IiwiaXNQZXJzb25hbEFjY291bnQiOiJGYWxzZSIsInNlc3Npb25JZCI6ImRmMDVhM2Q3MWQ5NWNiY2M1ZDc5ODViMSIsIm9yZ2FuaXphdGlvbklkIjoiOTA5MzA3NzgtMzJhNC00YmVkLTg0ODMtNDViMzBiYzkyOTRkIiwiZXhwIjoxNzc1NzI0NDI1LCJpYXQiOjE3NzU3MjA4MjUsIm5iZiI6MTc3NTcyMDgyNX0.m08XF-oeVnyQMnP7fNmumgidSFj9a5gZGpyjCq3JfBgXmSa1o2RWNDFN8aiZMPvVs_6gzkc-Z3_AOKJqWZf3wFZe3p_CqfLKvOiFHqXGKu9pl6ir0rcKQMYfTAVrInD955ffJiQhxSqxeg4IKkpR1fC8FJK0qyRnNCYLmDeGmWR35fWIw1Z1Dcl7aATAS8rgKOu8yLOLHgHzAhcvTzKwg8Z_EhqTwDo8lQAgWVXMLnlKRulzQ4mKgWv1dDsRDCVHPap_7-GMViBVmzeR3sqYI5ESVkLXRPo2cFfl30y7ajEm9YqYSfrf4WHXNWbBvuaN7Upy_8kTtz65-pl8wp5TkqVppNAdnhBZHpVo8FEMqIkuyY7xlZUKgXEgPR2BjkLb3kSZwxLFBAXvSY_AEqIh8RhtllMHMeuFvEb4ITaal7WOaN08YMlP3GNHaCvTeGyBNxhmNIWPXI5OOgip0eVLiOL3klcohUPs9BpChiWKhDL_qxs0grkD5-4IJM3sNEuQ'
export const DRIVE_URL = 'http://file-management-service-web.stage-feature-4.k8s.ya.sc.local'
export const DRIVE_APP_ID = 'aiAgents'
export const DRIVE_SECRET_KEY = 'Z8[9T#u8{|n5#&kN*Tz*r'

function parseJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.')
  if (parts.length < 2) throw new Error('Invalid JWT')
  const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as Record<string, unknown>
}

const JWT_CLAIMS = parseJwtPayload(TOKEN)
export const WORKSPACE_ID = JWT_CLAIMS.accountId as string
export const USER_ID = JWT_CLAIMS.userId as string
