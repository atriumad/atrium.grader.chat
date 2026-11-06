"use client"

import * as React from "react"
import {
  IconBrandTypescript,
  IconBug,
  IconBulb,
  IconCloud,
  IconCode,
  IconDeviceLaptop,
  IconFileText,
  IconFolder,
  IconFolderOpen,
  IconGitBranch,
  IconHistory,
  IconListCheck,
  IconMessageCircle,
  IconMarkdown,
  IconPaperclip,
  IconPencil,
  IconTelescope,
  IconTestPipe,
  IconWorld,
} from "@tabler/icons-react"

import { easeOut, prefersReducedMotion } from "@/lib/motion"

import {
  Attachment,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

import { DemoOptions, DemoPanel, DemoSection } from "../_demo/demo-panel"
import { StreamingText } from "../streaming/streaming-text"
import {
  PromptInputAddMenu,
  PromptInputContextUsage,
  PromptInputDictation,
  PromptInputFooter,
  PromptInputInset,
  PromptInputMeta,
  PromptInputMeter,
  PromptInputModel,
  PromptInputSelect,
  PromptInputSuggestions,
  PromptInputTool,
  type PromptEffort,
  type PromptModel,
  type PromptOption,
  type PromptTokenPricing,
} from "./prompt-controls"
import {
  PromptInput,
  PromptInputActions,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputQueue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptMessage,
  type PromptStatus,
} from "./prompt-input"
import { PromptInputMenu, type PromptMenuItem } from "./prompt-menu"
import { UploadError, type PromptUpload } from "./use-prompt-files"

const models: PromptModel[] = [
  { value: "nova", label: "Nova 3" },
  { value: "nova-mini", label: "Nova 3 Mini" },
  { value: "nova-max", label: "Nova 3 Max" },
]

const modelSpecs: Record<string, { limit: number; pricing: PromptTokenPricing }> = {
  nova: { limit: 200000, pricing: { input: 3, cachedInput: 0.3, output: 15 } },
  "nova-mini": { limit: 32000, pricing: { input: 0.25, cachedInput: 0.025, output: 1.25 } },
  "nova-max": { limit: 1000000, pricing: { input: 15, cachedInput: 1.5, output: 75 } },
}

const efforts: PromptEffort[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "extra", label: "Extra high" },
  { value: "max", label: "Max" },
]

const modes: PromptOption[] = [
  { value: "code", label: "Code", icon: <IconCode />, description: "Edits files and runs commands" },
  { value: "plan", label: "Plan", icon: <IconListCheck />, description: "Reads the code and proposes steps" },
  { value: "ask", label: "Ask", icon: <IconMessageCircle />, description: "Answers without touching files" },
]

const placeholders: Record<string, string> = {
  code: "Describe a change to make",
  plan: "What should we plan?",
  ask: "Ask about the codebase",
}

const locations: PromptOption[] = [
  { value: "local", label: "Local", icon: <IconDeviceLaptop />, description: "Runs on this machine" },
  { value: "cloud", label: "Cloud", icon: <IconCloud />, description: "Runs in a sandbox, even with the lid closed" },
]

const recentFolders: PromptOption[] = [
  { value: "~/code/hextaui", label: "hextaui", icon: <IconFolder />, description: "~/code/hextaui" },
  { value: "~/code/api", label: "api", icon: <IconFolder />, description: "~/code/api" },
]

const repositories: PromptOption[] = [
  { value: "hextaui/hextaui", label: "hextaui/hextaui", icon: <IconGitBranch /> },
  { value: "hextaui/api", label: "hextaui/api", icon: <IconGitBranch /> },
]

const sessions = [
  { id: "1", title: "Fix flaky search test", time: "12m", running: true },
  { id: "2", title: "Plan keyboard shortcuts", time: "2h", running: false },
  { id: "3", title: "Upgrade to React 19.2", time: "Yesterday", running: false },
]

type Variant = "chat" | "agent"

type DirectoryWindow = Window & {
  showDirectoryPicker?: () => Promise<{ name: string }>
}

function subscribeNothing() {
  return () => {}
}

function canPickDirectory() {
  return typeof (window as DirectoryWindow).showDirectoryPicker === "function"
}

function SessionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            shape="pill"
            className="ms-auto"
          />
        }
      >
        <IconHistory data-icon="inline-start" />
        Sessions
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel>Recent sessions</DropdownMenuLabel>
        {sessions.map((session) => (
          <DropdownMenuItem key={session.id}>
            <span
              aria-hidden="true"
              className={
                session.running
                  ? "size-1.5 shrink-0 rounded-full bg-success motion-safe:animate-pulse"
                  : "size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
              }
            />
            <span className="min-w-0 flex-1 truncate">{session.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {session.running ? "Running" : session.time}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const files: PromptMenuItem[] = [
  { value: "components/search.tsx", label: "search.tsx", hint: "components", icon: <IconBrandTypescript /> },
  { value: "lib/search.ts", label: "search.ts", hint: "lib", icon: <IconBrandTypescript /> },
  { value: "hooks/use-debounced-value.ts", label: "use-debounced-value.ts", hint: "hooks", icon: <IconBrandTypescript /> },
  { value: "README.md", label: "README.md", hint: "root", icon: <IconMarkdown /> },
  { value: "docs/search.md", label: "search.md", hint: "docs", icon: <IconFileText /> },
]

const commands: PromptMenuItem[] = [
  { value: "explain", label: "explain", description: "Walk through code step by step", icon: <IconBulb /> },
  { value: "fix", label: "fix", description: "Find and fix a bug", icon: <IconBug /> },
  { value: "test", label: "test", description: "Write tests for a file", icon: <IconTestPipe /> },
  { value: "plan", label: "plan", description: "Break work into steps", icon: <IconListCheck /> },
  { value: "rewrite", label: "rewrite", description: "Make text clearer", icon: <IconPencil /> },
]

const suggestions = [
  { label: "Explain a hook", prompt: "Explain how useDebouncedValue works and when to use it.", icon: <IconBulb data-icon="inline-start" /> },
  { label: "Review a diff", prompt: "Review this change for bugs and edge cases: ", icon: <IconBug data-icon="inline-start" /> },
  { label: "Plan a feature", prompt: "Plan the steps to add keyboard shortcuts to search.", icon: <IconListCheck data-icon="inline-start" /> },
]

const replies = [
  "Debouncing waits for a pause before acting. The hook keeps the latest value in state and only updates it once typing stops for the delay you pass, so anything reading it, like a search request, runs once per pause instead of on every keystroke.\n\nUse it for values that trigger expensive work: network requests, filtering big lists, or saving drafts.",
  "Here’s how I’d approach it. Start with the smallest version that works end to end, check it against the edge cases you care about, then tighten the parts that are slow or confusing. Send the file or a snippet and I’ll get specific.",
  "Two things stand out. The request isn’t cancelled when the query changes, so an older response can land after a newer one. And an empty query still hits the network. Abort the previous request and skip empty strings.",
]

type Turn =
  | { id: string; role: "user"; message: PromptMessage }
  | { id: string; role: "assistant"; text: string; streaming: boolean; stopped?: boolean }
  | { id: string; role: "summary" }

function between(min: number, max: number) {
  return min + Math.random() * (max - min)
}

const upload: PromptUpload = (file, { signal, onProgress }) =>
  new Promise((resolve, reject) => {
    let progress = 0
    const fail = Math.random() < 0.15
    const timer = setInterval(() => {
      progress += between(12, 28)
      if (fail && progress > 55) {
        clearInterval(timer)
        reject(new UploadError("Network error. Try again."))
        return
      }
      if (progress >= 100) {
        clearInterval(timer)
        resolve({ name: file.name })
        return
      }
      onProgress(progress)
    }, between(120, 220))
    signal.addEventListener("abort", () => clearInterval(timer))
  })

function UserTurn({ message }: { message: PromptMessage }) {
  const chips = [
    ...message.mentions.map((mention) => ({ id: mention.id, label: mention.label, icon: <IconFileText /> })),
    ...message.files.map((file) => ({ id: file.id, label: file.name, icon: <IconPaperclip /> })),
  ]

  return (
    <Message align="end">
      <MessageContent>
        {chips.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {chips.map((chip) => (
              <Attachment key={chip.id} size="xs">
                <AttachmentMedia>{chip.icon}</AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{chip.label}</AttachmentTitle>
                </AttachmentContent>
              </Attachment>
            ))}
          </div>
        ) : null}
        {message.text ? (
          <Bubble variant="secondary">
            <BubbleContent className="whitespace-pre-wrap"><span className="text-base">{message.text}</span></BubbleContent>
          </Bubble>
        ) : null}
      </MessageContent>
    </Message>
  )
}

function useDock(ref: React.RefObject<HTMLElement | null>, docked: boolean) {
  const lastTop = React.useRef<number | null>(null)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const top = element.getBoundingClientRect().top
    const from = lastTop.current
    lastTop.current = top
    if (from === null || Math.abs(from - top) < 1 || prefersReducedMotion()) return
    element.animate(
      [{ translate: `0 ${from - top}px` }, { translate: "0 0" }],
      { duration: 480, easing: easeOut }
    )
  }, [docked, ref])
}

function estimate(text: string) {
  return Math.ceil(text.length / 4)
}

export function PromptInputDemo() {
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [status, setStatus] = React.useState<PromptStatus>("ready")
  const [model, setModel] = React.useState("nova")
  const [effort, setEffort] = React.useState("medium")
  const [think, setThink] = React.useState(true)
  const [search, setSearch] = React.useState(false)
  const [research, setResearch] = React.useState(false)
  const [variant, setVariant] = React.useState<Variant>("agent")
  const [mode, setMode] = React.useState("code")
  const [location, setLocation] = React.useState("local")
  const [folders, setFolders] = React.useState(recentFolders)
  const [folder, setFolder] = React.useState<string>()
  const [repository, setRepository] = React.useState<string>()
  const pickable = React.useSyncExternalStore(subscribeNothing, canPickDirectory, () => false)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])
  const replyIndex = React.useRef(0)
  const dockRef = React.useRef<HTMLDivElement>(null)
  const empty = turns.length === 0
  useDock(dockRef, !empty)

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  React.useEffect(() => clearTimers, [])

  const respond = (id: string) => {
    const reply = replies[replyIndex.current++ % replies.length]
    const words = reply.split(/(?<= )/)
    let elapsed = between(500, 900)
    timers.current.push(
      setTimeout(() => {
        setStatus("streaming")
        setTurns((list) => [...list, { id, role: "assistant", text: "", streaming: true }])
      }, elapsed)
    )
    let shown = ""
    words.forEach((word, index) => {
      elapsed += between(25, 70)
      timers.current.push(
        setTimeout(() => {
          shown += word
          const text = shown
          const last = index === words.length - 1
          setTurns((list) =>
            list.map((turn) =>
              turn.id === id && turn.role === "assistant"
                ? { ...turn, text, streaming: !last }
                : turn
            )
          )
          if (last) setStatus("ready")
        }, elapsed)
      )
    })
  }

  const send = (message: PromptMessage) => {
    const id = `${Date.now()}`
    setTurns((list) => [...list, { id: `${id}-user`, role: "user", message }])
    setStatus("submitted")
    respond(`${id}-assistant`)
  }

  const stop = () => {
    clearTimers()
    setStatus("ready")
    setTurns((list) =>
      list.map((turn) =>
        turn.role === "assistant" && turn.streaming
          ? { ...turn, streaming: false, stopped: true }
          : turn
      )
    )
  }

  const browse = async () => {
    try {
      const picked = await (window as DirectoryWindow).showDirectoryPicker?.()
      if (!picked) return
      setFolders((list) =>
        list.some((item) => item.value === picked.name)
          ? list
          : [{ value: picked.name, label: picked.name, icon: <IconFolder /> }, ...list]
      )
      setFolder(picked.name)
    } catch {}
  }

  const reset = () => {
    clearTimers()
    setStatus("ready")
    setTurns([])
    requestAnimationFrame(() =>
      dockRef.current?.querySelector("textarea")?.focus()
    )
  }

  const compact = () =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        setTurns((list) =>
          list.length ? [...list, { id: `${Date.now()}-summary`, role: "summary" }] : list
        )
        resolve()
      }, 1400)
    })

  const lastUser = turns.findLast((turn) => turn.role === "user")
  const summaryIndex = turns.findLastIndex((turn) => turn.role === "summary")
  const recent = turns.slice(summaryIndex + 1)
  const prompted = recent.reduce(
    (total, turn) =>
      total +
      (turn.role === "user"
        ? estimate(turn.message.text) +
          turn.message.files.reduce((sum, file) => sum + Math.min(file.size / 4, 40000), 0) +
          turn.message.mentions.length * 6000
        : 0),
    summaryIndex >= 0 ? 1200 : 0
  )
  const answered = recent.reduce(
    (total, turn) => total + (turn.role === "assistant" ? estimate(turn.text) : 0),
    0
  )
  const reasoning = think ? Math.round(answered * 0.8) : 0
  const spec = modelSpecs[model] ?? modelSpecs.nova
  const usage = {
    inputTokens: 14200 + Math.round(prompted),
    cachedInputTokens: 14200,
    outputTokens: answered + reasoning,
    reasoningTokens: reasoning,
  }

  return (
    <MessageScrollerProvider autoScroll>
      <main className="flex h-svh flex-col bg-background">
        <DemoPanel
          description="Compare the chat and agent composers."
          onReset={() => {
            setVariant("agent")
            reset()
          }}
        >
          <DemoSection>
            <DemoOptions
              label="Composer"
              value={variant}
              defaultValue="agent"
              options={[
                { value: "chat", label: "Chat" },
                { value: "agent", label: "Agent" },
              ]}
              onValueChange={setVariant}
            />
          </DemoSection>
        </DemoPanel>
        <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
          {empty ? null : (
            <Button variant="ghost" size="sm" onClick={reset} className="col-start-3 justify-self-end">
              New chat
            </Button>
          )}
        </header>
        {empty ? (
          <div key="intro" className="flex flex-1 flex-col items-center justify-end px-4 pb-7">
            <h1 className="text-center text-2xl font-normal text-balance motion-safe:animate-in motion-safe:animation-duration-500 motion-safe:fade-in-0">
              What are we working on?
            </h1>
          </div>
        ) : (
          <MessageScroller key="thread" className="min-h-0 flex-1">
            <MessageScrollerViewport tabIndex={-1} aria-label="Conversation">
              <MessageScrollerContent aria-busy={status === "streaming"}>
                <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 pt-2 pb-10">
                  {turns.map((turn) =>
                    turn.role === "summary" ? (
                      <p
                        key={turn.id}
                        className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border motion-safe:animate-in motion-safe:fade-in-0"
                      >
                        Earlier messages summarized
                      </p>
                    ) : (
                    <MessageScrollerItem
                      key={turn.id}
                      messageId={turn.id}
                      scrollAnchor={turn.role === "user"}
                    >
                      <div className="p-px">
                        {turn.role === "user" ? (
                          <UserTurn message={turn.message} />
                        ) : (
                          <div className="flex flex-col gap-2">
                            <StreamingText
                              text={turn.text}
                              streaming={turn.streaming}
                              className="text-base/relaxed"
                            />
                            {turn.stopped ? (
                              <p className="text-xs text-muted-foreground">Stopped</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </MessageScrollerItem>
                    )
                  )}
                </div>
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        )}
        <div
          key="composer"
          ref={dockRef}
          className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3"
        >
          <PromptInput
            status={status}
            onSubmit={send}
            onStop={stop}
            onEditLast={() =>
              lastUser?.role === "user" ? lastUser.message.text : undefined
            }
            upload={upload}
            accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.go,.rs"
            maxFileSize={10 * 1024 * 1024}
            maxLength={8000}
            draftKey="hextaui-prompt-input-demo"
            layout={variant === "agent" ? "expanded" : "auto"}
            globalDrop
            focusOnType
          >
            <PromptInputQueue />
            {variant === "agent" ? (
              <PromptInputInset>
                <PromptInputBody>
                  <PromptInputAttachments />
                  <PromptInputTools>
                    <PromptInputAddMenu />
                    <PromptInputSelect
                      label="Mode"
                      options={modes}
                      value={mode}
                      onValueChange={setMode}
                      shortcut="alt+m"
                    />
                  </PromptInputTools>
                  <PromptInputTextarea
                    autoFocus
                    placeholder={placeholders[mode]}
                    className="min-h-16"
                  />
                  <PromptInputActions>
                    <PromptInputModel
                      models={models}
                      model={model}
                      onModelChange={setModel}
                      levels={efforts}
                      effort={effort}
                      onEffortChange={setEffort}
                      recommended="medium"
                      thinking={think}
                      onThinkingChange={setThink}
                    />
                    <PromptInputSubmit />
                  </PromptInputActions>
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputSelect
                    label="Run on"
                    options={locations}
                    value={location}
                    onValueChange={setLocation}
                  />
                  {location === "local" ? (
                    <PromptInputSelect
                      label="Folder"
                      heading="Recent"
                      options={folders}
                      value={folder}
                      onValueChange={setFolder}
                      placeholder="Choose folder"
                      icon={<IconFolderOpen />}
                    >
                      {pickable ? (
                        <DropdownMenuItem onClick={() => void browse()}>
                          <IconFolderOpen />
                          Open folder…
                        </DropdownMenuItem>
                      ) : null}
                    </PromptInputSelect>
                  ) : (
                    <PromptInputSelect
                      label="Repository"
                      options={repositories}
                      value={repository}
                      onValueChange={setRepository}
                      placeholder="Choose repository"
                      icon={<IconGitBranch />}
                    />
                  )}
                  <SessionsMenu />
                </PromptInputFooter>
              </PromptInputInset>
            ) : (
            <PromptInputBody>
              <PromptInputAttachments />
              <PromptInputTools>
                <PromptInputAddMenu>
                  <DropdownMenuCheckboxItem
                    indicator="end"
                    checked={search}
                    onCheckedChange={setSearch}
                  >
                    <IconWorld />
                    Web search
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    indicator="end"
                    checked={research}
                    onCheckedChange={setResearch}
                  >
                    <IconTelescope />
                    Deep research
                  </DropdownMenuCheckboxItem>
                </PromptInputAddMenu>
                {search ? (
                  <PromptInputTool
                    icon={<IconWorld />}
                    tone="blue"
                    onRemove={() => setSearch(false)}
                  >
                    Search
                  </PromptInputTool>
                ) : null}
                {research ? (
                  <PromptInputTool
                    icon={<IconTelescope />}
                    tone="violet"
                    onRemove={() => setResearch(false)}
                  >
                    Research
                  </PromptInputTool>
                ) : null}
              </PromptInputTools>
              <PromptInputTextarea
                autoFocus
                placeholder={
                  search ? "Search the web" : research ? "Get a detailed report" : "Ask anything"
                }
              />
              <PromptInputActions>
                <PromptInputMeter />
                <PromptInputDictation autoSend />
                <PromptInputSubmit />
              </PromptInputActions>
            </PromptInputBody>
            )}
            {variant === "chat" ? (
            <PromptInputMeta>
              <PromptInputModel
                models={models}
                model={model}
                onModelChange={setModel}
                levels={efforts}
                effort={effort}
                onEffortChange={setEffort}
                recommended="medium"
                thinking={think}
                onThinkingChange={setThink}
              />
              <PromptInputContextUsage
                usage={usage}
                limit={spec.limit}
                model={models.find((item) => item.value === model)?.label}
                pricing={spec.pricing}
                onCompact={compact}
                limits={[
                  { label: "Session", used: 0.48, detail: "Resets in 1 hr 7 min" },
                  { label: "Weekly, all models", used: 0.07, detail: "Resets Tue 8:30 AM" },
                ]}
              />
            </PromptInputMeta>
            ) : null}
            {empty ? <PromptInputSuggestions suggestions={suggestions} className="pt-3" /> : null}
            <PromptInputMenu trigger="@" items={files} label="Files" />
            <PromptInputMenu trigger="/" items={commands} />
          </PromptInput>
        </div>
        {empty ? <div key="outro" className="flex-1" /> : null}
      </main>
    </MessageScrollerProvider>
  )
}
