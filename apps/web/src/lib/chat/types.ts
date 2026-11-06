// Shapes shared between the chat route and the UIs. Copied to the mobile app.
export type Slot = { start: string; end: string; label: string }
export type Proposal = { start: string; label: string; name: string; email: string; phone: string; notes: string }
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "slots"; slots: Slot[] }
  | { type: "proposal"; proposal: Proposal }
  | { type: "error"; text: string }
