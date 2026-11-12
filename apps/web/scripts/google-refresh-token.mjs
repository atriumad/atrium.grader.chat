// One-time helper: gets a Google Calendar refresh token and stores it in .env.local.
// Run from apps/web:  node scripts/google-refresh-token.mjs
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a "Desktop app" OAuth client) in .env.local.
// The token is written to .env.local and never printed.

import fs from "node:fs"
import http from "node:http"
import { randomBytes } from "node:crypto"

const ENV = new URL("../.env.local", import.meta.url)
const env = fs.readFileSync(ENV, "utf8")
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim()
const id = get("GOOGLE_CLIENT_ID")
const secret = get("GOOGLE_CLIENT_SECRET")
if (!id || !secret) {
  console.error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in .env.local")
  process.exit(1)
}

const state = randomBytes(16).toString("hex")
const scopes = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"]

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1")
  if (url.pathname !== "/") return res.writeHead(404).end()
  const fail = (msg) => {
    res.writeHead(400, { "Content-Type": "text/plain" }).end(msg)
    console.error(msg)
    server.close()
    process.exit(1)
  }
  if (url.searchParams.get("state") !== state) return fail("State mismatch. Aborted.")
  const code = url.searchParams.get("code")
  if (!code) return fail(`Google returned: ${url.searchParams.get("error") ?? "no code"}`)
  const redirect = `http://127.0.0.1:${server.address().port}`
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  })
  const json = await tok.json()
  if (!tok.ok || !json.refresh_token) return fail(`Token exchange failed: ${json.error_description ?? json.error ?? tok.status}`)
  let next = fs.readFileSync(ENV, "utf8").replace(/^GOOGLE_REFRESH_TOKEN=.*\n?/gm, "")
  if (!next.endsWith("\n")) next += "\n"
  fs.writeFileSync(ENV, `${next}GOOGLE_REFRESH_TOKEN=${json.refresh_token}\n`)
  res.writeHead(200, { "Content-Type": "text/plain" }).end("Done. You can close this tab and return to the terminal.")
  console.log("Refresh token saved to .env.local (not printed).")
  server.close()
})

server.listen(0, "127.0.0.1", () => {
  const redirect = `http://127.0.0.1:${server.address().port}`
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  auth.search = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString()
  console.log("Open this URL in your browser, signed in with the agency calendar account:\n")
  console.log(auth.toString())
})
