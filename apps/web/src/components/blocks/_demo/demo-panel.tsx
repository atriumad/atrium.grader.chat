"use client"

import * as React from "react"
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconRefresh,
  IconX,
} from "@tabler/icons-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type DemoPanelContextValue = {
  report: (id: string, changed: boolean) => void
}

const DemoPanelContext = React.createContext<DemoPanelContextValue | null>(null)

const storageKey = "hextaui-demo-panel"

function readOpen() {
  try {
    return window.localStorage.getItem(storageKey) === "open"
  } catch {
    return false
  }
}

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(storageKey, open ? "open" : "closed")
  } catch {}
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(
    element?.closest("input, textarea, select, [contenteditable=true]")
  )
}

function useChanged(changed: boolean) {
  const context = React.useContext(DemoPanelContext)
  const id = React.useId()
  React.useEffect(() => {
    context?.report(id, changed)
    return () => context?.report(id, false)
  }, [context, id, changed])
}

type DemoPanelProps = {
  title?: string
  description?: string
  onReset?: () => void
  defaultOpen?: boolean
  children: React.ReactNode
}

function DemoPanel({
  title = "Demo",
  description,
  onReset,
  defaultOpen,
  children,
}: DemoPanelProps) {
  const [open, setOpen] = React.useState(false)
  const [changed, setChanged] = React.useState<Set<string>>(() => new Set())
  const panelId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setOpen(defaultOpen ?? readOpen())
  }, [defaultOpen])

  const toggle = React.useCallback((next: boolean) => {
    setOpen(next)
    writeOpen(next)
  }, [])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "\\" || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target)) return
      event.preventDefault()
      setOpen((current) => {
        writeOpen(!current)
        return !current
      })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const context = React.useMemo<DemoPanelContextValue>(
    () => ({
      report: (id, isChanged) =>
        setChanged((current) => {
          if (current.has(id) === isChanged) return current
          const next = new Set(current)
          if (isChanged) next.add(id)
          else next.delete(id)
          return next
        }),
    }),
    []
  )

  const count = changed.size

  return (
    <DemoPanelContext.Provider value={context}>
      <div
        data-slot="demo-panel"
        data-open={open ? "" : undefined}
        className="pointer-events-none fixed end-3 top-3 z-40 flex max-h-[calc(100svh-1.5rem)] w-72 max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2"
      >
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => toggle(!open)}
          className="pointer-events-auto relative inline-flex h-8 items-center gap-1.5 rounded-full bg-popover ps-2.5 pe-3 text-sm font-medium text-popover-foreground shadow-md ring-(length:--hairline) ring-foreground/10 outline-none transition-transform duration-150 ease-out-quint select-none focus-visible:ring-3 focus-visible:ring-focus-ring motion-safe:active:scale-[0.97] pointer-coarse:h-10 forced-colors:border"
        >
          <IconAdjustmentsHorizontal aria-hidden="true" className="size-4" />
          {title}
          {count > 0 ? (
            <span className="ms-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground tabular-nums">
              {count}
              <span className="sr-only"> changed</span>
            </span>
          ) : null}
          <IconChevronDown
            aria-hidden="true"
            className="size-3.5 text-muted-foreground transition-transform duration-200 ease-out-quint in-aria-expanded:rotate-180 motion-reduce:transition-none"
          />
        </button>
        <section
          id={panelId}
          aria-label={`${title} controls`}
          hidden={!open}
          className="pointer-events-auto flex min-h-0 w-full origin-top-right flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-(length:--hairline) ring-foreground/10 forced-colors:border motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:animation-duration-150"
        >
          <header className="flex items-center gap-2 border-b px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">Demo controls</span>
              {description ? (
                <span className="text-xs text-pretty text-muted-foreground">
                  {description}
                </span>
              ) : null}
            </div>
            {onReset ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Reset demo"
                onClick={onReset}
              >
                <IconRefresh />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close demo controls"
              onClick={() => {
                toggle(false)
                triggerRef.current?.focus()
              }}
            >
              <IconX />
            </Button>
          </header>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-none p-3">
            {children}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span>Not part of the block</span>
            <span className="flex items-center gap-1 pointer-coarse:hidden">
              <Kbd>\</Kbd> to toggle
            </span>
          </footer>
        </section>
      </div>
    </DemoPanelContext.Provider>
  )
}

function DemoSection({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {title ? (
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      ) : null}
      {children}
    </div>
  )
}

type DemoOption<Value extends string> = { value: Value; label: string }

function DemoOptions<Value extends string>({
  label,
  value,
  defaultValue,
  options,
  onValueChange,
  description,
}: {
  label: string
  value: Value
  defaultValue?: Value
  options: DemoOption<Value>[]
  onValueChange: (value: Value) => void
  description?: string
}) {
  const id = React.useId()
  useChanged(defaultValue !== undefined && value !== defaultValue)
  const compact =
    options.length <= 3 &&
    options.reduce((total, option) => total + option.label.length, 0) <= 24

  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm">
        {label}
      </span>
      {compact ? (
        <ToggleGroup
          aria-labelledby={id}
          variant="outline"
          size="sm"
          value={[value]}
          onValueChange={(next) => {
            if (next[0]) onValueChange(next[0] as Value)
          }}
          className="w-full"
        >
          {options.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <Select
          items={options}
          value={value}
          onValueChange={(next) => onValueChange(next as Value)}
        >
          <SelectTrigger aria-labelledby={id} size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {description ? (
        <span className="text-xs text-pretty text-muted-foreground">{description}</span>
      ) : null}
    </div>
  )
}

function DemoSwitch({
  label,
  description,
  checked,
  defaultChecked = false,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  defaultChecked?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = React.useId()
  useChanged(checked !== defaultChecked)
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        {description ? (
          <span className="text-xs text-pretty text-muted-foreground">{description}</span>
        ) : null}
      </label>
      <Switch
        id={id}
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

function DemoAction({
  children,
  onClick,
  icon,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => unknown
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </Button>
  )
}

function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-pretty text-muted-foreground [&_code]:font-mono [&_code]:text-foreground">
      {children}
    </p>
  )
}

function DemoValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate tabular-nums">{value}</span>
    </div>
  )
}

function DemoCopyList({
  items,
}: {
  items: { value: string; label: string }[]
}) {
  const [copied, setCopied] = React.useState<string | null>(null)
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.value} className="flex items-center justify-between gap-2 py-1">
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-xs">{item.value}</span>
            <span className="truncate text-xs text-muted-foreground">{item.label}</span>
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Copy ${item.value}`}
            onClick={() => {
              void navigator.clipboard?.writeText(item.value.replace(/\s/g, ""))
              setCopied(item.value)
              setTimeout(() => setCopied(null), 1200)
            }}
          >
            {copied === item.value ? <IconCheck /> : <IconCopy />}
          </Button>
        </li>
      ))}
    </ul>
  )
}

export {
  DemoAction,
  DemoCopyList,
  DemoNote,
  DemoOptions,
  DemoPanel,
  DemoSection,
  DemoSwitch,
  DemoValue,
}
export type { DemoOption, DemoPanelProps }
