import { Resend } from "resend"

import { bookingConfig } from "./config"
import { formatSlot } from "./tz"

// Emails sent after a meeting is booked:
//  - the visitor gets a confirmation (with the Meet link and an .ics file to add it to their calendar);
//  - the operations team gets the meeting and the client's details.
// Env: RESEND_API_KEY, BOOKING_FROM_EMAIL ("Atrium <meetings@atriumad.com>"), BOOKING_NOTIFY_EMAILS (comma list).
// A failure here never undoes the booking: the meeting already exists in the calendar.

export type BookingEmailData = {
  id: string
  start: string // ISO UTC
  end: string // ISO UTC
  name: string
  email: string
  phone: string
  notes: string
  businessName: string
  score: number | null
  meetLink?: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
// RFC 5545 text escaping and 75-octet line folding.
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ` ${rest.slice(74)}`
  }
  out.push(rest)
  return out.join("\r\n")
}

export function buildIcs(d: BookingEmailData, from: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atrium//Grader//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${d.id}@atriumad.com`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(d.start)}`,
    `DTEND:${icsDate(d.end)}`,
    `SUMMARY:${icsText("Atrium consultation")}`,
    `DESCRIPTION:${icsText(`Meeting with the Atrium team about ${d.businessName}.${d.meetLink ? `\nJoin: ${d.meetLink}` : ""}`)}`,
    ...(d.meetLink ? [`LOCATION:${icsText(d.meetLink)}`] : []),
    `ORGANIZER;CN=Atrium:mailto:${from}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1b18">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="font-size:13px;letter-spacing:.04em;color:#6b665d;margin:0 0 14px">ATRIUM</p>
<div style="background:#fff;border:1px solid #e4dfd4;border-radius:14px;padding:24px">
<h1 style="font-size:20px;line-height:1.3;margin:0 0 14px">${title}</h1>${body}</div></div></body></html>`

const row = (k: string, v: string) =>
  `<tr><td style="padding:6px 14px 6px 0;color:#6b665d;font-size:14px;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0;font-size:14px">${v}</td></tr>`

function visitorEmail(d: BookingEmailData, when: string, tz: string) {
  const meet = d.meetLink
    ? `<p style="margin:18px 0 0"><a href="${esc(d.meetLink)}" style="display:inline-block;background:#1d1b18;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9px;font-size:14px">Join the video call</a></p>`
    : ""
  const html = shell(
    "Your meeting is confirmed",
    `<p style="font-size:14px;line-height:1.6;margin:0 0 14px">Hi ${esc(d.name)}, thanks for booking time with the Atrium team. We will go through the results for <strong>${esc(d.businessName)}</strong> and what to improve first.</p>
<table style="border-collapse:collapse">${row("When", esc(when))}${row("Length", "30 minutes")}${row("Time zone", esc(tz.replace("_", " ")))}${d.meetLink ? row("Where", `<a href="${esc(d.meetLink)}">${esc(d.meetLink)}</a>`) : ""}</table>${meet}
<p style="font-size:13px;color:#6b665d;line-height:1.6;margin:18px 0 0">The attached file adds the meeting to your calendar. Need to change the time? Just reply to this email.</p>`
  )
  const text = `Hi ${d.name},\n\nYour meeting with the Atrium team is confirmed.\n\nWhen: ${when}\nBusiness: ${d.businessName}${d.meetLink ? `\nJoin: ${d.meetLink}` : ""}\n\nNeed to change the time? Just reply to this email.`
  return { html, text }
}

function opsEmail(d: BookingEmailData, when: string) {
  const html = shell(
    `New meeting: ${esc(d.businessName)}`,
    `<p style="font-size:14px;margin:0 0 6px;font-weight:600">Meeting</p>
<table style="border-collapse:collapse;margin-bottom:14px">${row("When", esc(when))}${d.meetLink ? row("Meet", `<a href="${esc(d.meetLink)}">${esc(d.meetLink)}</a>`) : ""}</table>
<p style="font-size:14px;margin:0 0 6px;font-weight:600">Client</p>
<table style="border-collapse:collapse">${row("Name", esc(d.name))}${row("Email", `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`)}${d.phone ? row("Phone", esc(d.phone)) : ""}${row("Business", esc(d.businessName))}${d.score != null ? row("Atrium Score", `${d.score}/100`) : ""}${d.notes ? row("Notes", esc(d.notes)) : ""}</table>
<p style="font-size:13px;color:#6b665d;margin:16px 0 0">Reply to this email to write to the client directly.</p>`
  )
  const text = `New meeting: ${d.businessName}\n\nWhen: ${when}${d.meetLink ? `\nMeet: ${d.meetLink}` : ""}\n\nClient: ${d.name}\nEmail: ${d.email}${d.phone ? `\nPhone: ${d.phone}` : ""}\nBusiness: ${d.businessName}${d.score != null ? `\nAtrium Score: ${d.score}/100` : ""}${d.notes ? `\nNotes: ${d.notes}` : ""}`
  return { html, text }
}

export const notifyList = (raw = process.env.BOOKING_NOTIFY_EMAILS): string[] =>
  (raw ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]{2,}$/.test(e))

export function emailsConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.BOOKING_FROM_EMAIL
}

// Sends both emails. Never throws; returns what happened so the caller can log it.
export async function sendBookingEmails(d: BookingEmailData): Promise<{ visitor: boolean; ops: boolean; error?: string }> {
  if (!emailsConfigured()) return { visitor: false, ops: false, error: "Email is not configured (RESEND_API_KEY / BOOKING_FROM_EMAIL)." }
  const cfg = bookingConfig()
  const from = process.env.BOOKING_FROM_EMAIL!
  const fromAddr = from.match(/<([^>]+)>/)?.[1] ?? from
  const when = formatSlot(new Date(d.start), cfg.timezone)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const ics = Buffer.from(buildIcs(d, fromAddr)).toString("base64")

  const v = visitorEmail(d, when, cfg.timezone)
  const o = opsEmail(d, when)
  const ops = notifyList()

  const [vr, or] = await Promise.allSettled([
    resend.emails.send({
      from,
      to: d.email,
      replyTo: ops[0],
      subject: `Your meeting with Atrium is confirmed · ${when}`,
      html: v.html,
      text: v.text,
      attachments: [{ filename: "atrium-meeting.ics", content: ics, contentType: "text/calendar; method=PUBLISH" }],
    }),
    ops.length
      ? resend.emails.send({
          from,
          to: ops,
          replyTo: d.email,
          subject: `New meeting · ${d.businessName} · ${when}`,
          html: o.html,
          text: o.text,
        })
      : Promise.reject(new Error("BOOKING_NOTIFY_EMAILS is empty.")),
  ])
  const ok = (r: PromiseSettledResult<{ error: unknown }>) => r.status === "fulfilled" && !r.value.error
  const err = [vr, or]
    .map((r) => (r.status === "rejected" ? String(r.reason?.message ?? r.reason) : (r.value as { error?: { message?: string } }).error?.message))
    .filter(Boolean)
    .join(" | ")
  return { visitor: ok(vr as never), ops: ok(or as never), error: err || undefined }
}
