import { randomBytes } from "node:crypto"
import { hashKey } from "../src/auth.ts"

// Prints a new API key (give it to the caller once) and its hash (put it in the env var named by keyHashEnv).
const key = `atg_${randomBytes(24).toString("base64url")}`
console.log(`API key (shown once): ${key}`)
console.log(`Hash for the env var:  ${hashKey(key)}`)
