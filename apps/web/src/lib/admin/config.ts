// Editable agent behavior + published scoring rules, stored in Supabase (app_config).
// Everything falls back to the code defaults when Supabase is not configured or fails,
// so the public app never depends on the admin panel being up.

import {
  DEFAULT_SCORE_CONFIG,
  sanitizeScoreConfig,
  serializeScoreConfig,
  type ScoreConfig,
} from "@atrium/shared/metrics"
import { db, supabaseConfigured } from "@/lib/supabase/server"

export type ConfigKey = "scoring" | "agent"

export { DEFAULT_AGENT_CONFIG, sanitizeAgentConfig, type AgentConfig } from "@/lib/admin/agent-config"
import { DEFAULT_AGENT_CONFIG, sanitizeAgentConfig, type AgentConfig } from "@/lib/admin/agent-config"

type Stored = { value: unknown; updated_at: string; updated_by: string | null }
const cache = new Map<ConfigKey, { at: number; row: Stored | null }>()
const TTL_MS = 30_000

async function readRow(key: ConfigKey, fresh = false): Promise<Stored | null> {
  if (!supabaseConfigured()) return null
  const hit = cache.get(key)
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.row
  try {
    const { data, error } = await db().from("app_config").select("value, updated_at, updated_by").eq("key", key).maybeSingle()
    if (error) throw error
    cache.set(key, { at: Date.now(), row: (data as Stored | null) ?? null })
    return (data as Stored | null) ?? null
  } catch {
    return hit?.row ?? null // keep serving the last known value
  }
}

export async function getScoring(fresh = false): Promise<{ config: ScoreConfig; custom: boolean; updatedAt: string | null; updatedBy: string | null }> {
  const row = await readRow("scoring", fresh)
  return {
    config: row ? sanitizeScoreConfig(row.value) : DEFAULT_SCORE_CONFIG,
    custom: !!row,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  }
}

export async function getAgent(fresh = false): Promise<{ config: AgentConfig; custom: boolean; updatedAt: string | null; updatedBy: string | null }> {
  const row = await readRow("agent", fresh)
  return {
    config: row ? sanitizeAgentConfig(row.value) : DEFAULT_AGENT_CONFIG,
    custom: !!row,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  }
}

// Value as stored (JSON-safe). Sanitizes first so the DB never holds out-of-range numbers.
export async function saveConfig(key: ConfigKey, input: unknown, by: string, note?: string) {
  const value = key === "scoring" ? serializeScoreConfig(sanitizeScoreConfig(input)) : sanitizeAgentConfig(input)
  const now = new Date().toISOString()
  const { error } = await db().from("app_config").upsert({ key, value, updated_at: now, updated_by: by })
  if (error) throw new Error(error.message)
  await db().from("config_history").insert({ key, value, note: note?.slice(0, 200) ?? null, created_by: by })
  cache.delete(key)
  return value
}

export async function resetConfig(key: ConfigKey, by: string) {
  const { error } = await db().from("app_config").delete().eq("key", key)
  if (error) throw new Error(error.message)
  await db().from("config_history").insert({ key, value: key === "scoring" ? serializeScoreConfig(DEFAULT_SCORE_CONFIG) : DEFAULT_AGENT_CONFIG, note: "Restablecido a los valores por defecto", created_by: by })
  cache.delete(key)
}

export async function configHistory(key: ConfigKey, limit = 15) {
  const { data } = await db().from("config_history").select("id, value, note, created_at, created_by").eq("key", key).order("created_at", { ascending: false }).limit(limit)
  return (data ?? []) as Array<{ id: number; value: unknown; note: string | null; created_at: string; created_by: string | null }>
}
