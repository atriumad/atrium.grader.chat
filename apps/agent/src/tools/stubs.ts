import type { ToolDef } from "./types.ts"
import { failure } from "./types.ts"

// Placeholders until the lookups are extracted from apps/web into packages/sources.
// They fail explicitly, so a run shows "not implemented" in its gaps rather than empty data.
const stub = (name: string): ToolDef => ({ name, run: async () => failure("not_implemented", "stub") })

export const stubTools: ToolDef[] = ["google_listing", "find_competitors", "social_public", "website_audit"].map(stub)
