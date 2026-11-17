import { getSettings } from './db'
import type { ServerStatus } from '../ai/types'

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function headers(extra?: HeadersInit): Promise<Headers> {
  const h = new Headers(extra)
  const { apiToken } = await getSettings()
  if (apiToken) h.set('Authorization', `Bearer ${apiToken}`)
  return h
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { ...init, headers: await headers(init.headers) })
  } catch {
    throw new ApiError('Could not reach the MyMindSet server. Is it running?', 0)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Request failed (${res.status})`, res.status)
  return body as T
}

export async function getServerStatus(): Promise<ServerStatus | null> {
  try {
    const res = await fetch('/api/status')
    if (!res.ok) return null
    return (await res.json()) as ServerStatus
  } catch { return null }
}

export interface TrendItem { title: string; url: string; source?: string; publishedAt?: string }
export interface TrendResponse { query: string; geo: string; source: string; fetchedAt: string; items: TrendItem[] }

export const fetchTrends = (q: string, geo: string) =>
  apiFetch<TrendResponse>(`/api/trends?q=${encodeURIComponent(q)}&geo=${encodeURIComponent(geo)}`)

export async function transcribeOnServer(blob: Blob): Promise<string> {
  const form = new FormData()
  form.set('audio', blob, `recording.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`)
  const { text } = await apiFetch<{ text: string }>('/api/transcribe', { method: 'POST', body: form })
  return text
}
