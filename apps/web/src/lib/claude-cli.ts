// Runs the analysis through the local `claude` CLI so it uses the user's Claude
// plan (subscription login) instead of an API key.
//
// NOTE: this is meant for personal/local use. Anthropic's terms do not allow
// routing a product's users through a Free/Pro/Max login. For anything served
// to customers, set ANALYSIS_PROVIDER=api and use an API key.

import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"

const TIMEOUT_MS = 110_000

export async function* streamViaClaudeCli(opts: {
  system: string
  prompt: string
}): AsyncGenerator<string> {
  // Neutral working directory so no project CLAUDE.md or AGENTS.md is picked up.
  const cwd = join(tmpdir(), "atrium-grader-claude")
  mkdirSync(cwd, { recursive: true })

  // An API key in the environment would make the CLI bill the API instead of the plan.
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN

  const args = [
    "-p",
    "--model", process.env.CLAUDE_CLI_MODEL ?? "sonnet",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--system-prompt", opts.system,
    "--tools", "",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
  ]

  const child = spawn(/*turbopackIgnore: true*/ process.env.CLAUDE_BIN ?? "claude", args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  })

  let stderr = ""
  child.stderr.on("data", (d) => {
    stderr = (stderr + d.toString()).slice(-2000)
  })
  let spawnFailure: Error | null = null
  child.on("error", (e) => {
    spawnFailure = new Error(
      `I could not run the Claude CLI (${e.message}). Is it installed and signed in?`
    )
  })

  const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS)
  child.stdin.on("error", () => {})
  child.stdin.end(opts.prompt)

  let gotText = false
  try {
    const rl = createInterface({ input: child.stdout })
    for await (const line of rl) {
      if (!line.trim()) continue
      let evt: any
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      if (
        evt.type === "stream_event" &&
        evt.event?.type === "content_block_delta" &&
        evt.event.delta?.type === "text_delta"
      ) {
        gotText = true
        yield evt.event.delta.text as string
      } else if (evt.type === "result" && evt.is_error) {
        throw new Error(`Claude (plan): ${String(evt.result ?? "error").slice(0, 300)}`)
      }
    }
    if (spawnFailure) throw spawnFailure
    if (!gotText) {
      throw new Error(
        `Claude returned no text. ${stderr.trim().slice(0, 300) || "Check that you are signed in with `claude` (/login)."}`
      )
    }
  } finally {
    clearTimeout(timer)
    if (child.exitCode === null) child.kill("SIGTERM")
  }
}
