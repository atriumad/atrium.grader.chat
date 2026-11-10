import { findCompetitorsTool, googleListing, socialPublic } from "./real.ts"
import { stubTools } from "./stubs.ts"
import { createRegistry } from "./types.ts"

// Real tools override the stubs of the same name. What remains a stub is not implemented yet
// (website_audit still lives in apps/web) and reports not_implemented.
export const defaultRegistry = () => createRegistry([...stubTools, googleListing, findCompetitorsTool, socialPublic])
