// Text arrives from the stream in bursts. The pacer reveals it at a steady rate (faster when it
// falls behind) so it flows instead of jumping.
export function createPacer(onText: (visible: string) => void) {
  let target = ""
  let shown = 0
  const timer = setInterval(() => {
    if (shown >= target.length) return
    const backlog = target.length - shown
    shown = Math.min(target.length, shown + Math.max(2, Math.ceil(backlog / 14)))
    onText(target.slice(0, shown))
  }, 40)
  return {
    push(chunk: string) {
      target += chunk
    },
    get text() {
      return target
    },
    drain: () =>
      new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (shown >= target.length) {
            clearInterval(check)
            resolve()
          }
        }, 40)
      }),
    stop() {
      clearInterval(timer)
    },
  }
}
