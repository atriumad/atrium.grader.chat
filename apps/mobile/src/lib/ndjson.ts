// Newline-delimited JSON reader. Pure (no React Native imports) so it can be tested in Node.

export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          yield JSON.parse(line) as T
        } catch {
          // A malformed line should not kill the whole stream.
        }
      }
    }
    const rest = buffer.trim()
    if (rest) {
      try {
        yield JSON.parse(rest) as T
      } catch {
        // ignore trailing partial line
      }
    }
  } finally {
    reader.releaseLock()
  }
}
