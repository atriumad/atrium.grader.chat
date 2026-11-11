import { useState } from "react"
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native"

import { book, type Proposal } from "@/lib/chat"
import { colors, fonts, radius, shadow } from "@/theme"

type State =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "done"; label: string; mock: boolean; meetLink: string | null }
  | { kind: "error"; message: string; conflict: boolean }

// The only place a meeting is created: nothing is booked until the user taps Confirm.
export function BookingCard({
  proposal,
  businessName,
  score,
  active,
  onConflict,
}: {
  proposal: Proposal
  businessName: string
  score: number | null
  active: boolean // false once the conversation has moved on
  onConflict: () => void
}) {
  const [name, setName] = useState(proposal.name)
  const [email, setEmail] = useState(proposal.email)
  const [phone, setPhone] = useState(proposal.phone)
  const [state, setState] = useState<State>({ kind: "idle" })

  const saving = state.kind === "saving"
  const valid = name.trim().length > 1 && /^\S+@\S+\.\S+$/.test(email.trim())

  async function confirm() {
    if (!active || saving || !valid) return
    setState({ kind: "saving" })
    const r = await book({
      start: proposal.start,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: proposal.notes,
      businessName,
      score,
    })
    setState(r.ok ? { kind: "done", label: r.label, mock: r.mock, meetLink: r.meetLink } : { kind: "error", message: r.message, conflict: r.conflict })
  }

  if (state.kind === "done") {
    return (
      <View style={[styles.card, { flexDirection: "row", gap: 12 }]} accessibilityRole="alert">
        <Text style={styles.check}>✓</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title}>Meeting booked</Text>
          <Text style={styles.text}>{state.label}</Text>
          <Text style={styles.muted}>
            {state.mock ? "Test mode: no real event was created and no invitation was sent." : `An invitation will be sent to ${email}.`}
          </Text>
          {state.meetLink ? (
            <Pressable onPress={() => void Linking.openURL(state.meetLink!)} accessibilityRole="link">
              <Text style={styles.link}>Video call link</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  const locked = !active || saving
  return (
    <View style={styles.card}>
      <View style={{ gap: 2 }}>
        <Text style={styles.title}>Review and confirm your meeting</Text>
        <Text style={styles.muted}>{proposal.label}</Text>
      </View>
      <Field label="Nombre" value={name} onChangeText={setName} editable={!locked} autoComplete="name" textContentType="name" />
      <Field
        label="Correo"
        value={email}
        onChangeText={setEmail}
        editable={!locked}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        editable={!locked}
        autoComplete="tel"
        textContentType="telephoneNumber"
        keyboardType="phone-pad"
      />
      {proposal.notes ? <Text style={styles.muted}>Tema: {proposal.notes}</Text> : null}
      <Text style={[styles.muted, { fontSize: 12 }]}>
        By confirming you share your name, email and phone with the Atrium team only to schedule and handle this meeting.
      </Text>
      {state.kind === "error" ? (
        <View style={{ gap: 8 }} accessibilityRole="alert">
          <Text style={[styles.text, { color: colors.destructive }]}>{state.message}</Text>
          {state.conflict ? (
            <Pressable onPress={onConflict} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>See other times</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => void confirm()}
        disabled={locked || !valid}
        style={({ pressed }) => [styles.primary, (locked || !valid) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
      >
        {saving ? <ActivityIndicator size="small" color={colors.background} /> : null}
        <Text style={styles.primaryText}>{saving ? "Booking…" : "Confirm meeting"}</Text>
      </Pressable>
    </View>
  )
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.mutedForeground} style={[styles.input, props.editable === false && { opacity: 0.6 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 14, ...shadow },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.foreground },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.foreground },
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.foreground },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  primary: { height: 50, borderRadius: radius.pill, backgroundColor: colors.foreground, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.background },
  secondary: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  secondaryText: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  check: { fontFamily: fonts.semibold, fontSize: 18, color: colors.positive },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand, textDecorationLine: "underline" },
})
