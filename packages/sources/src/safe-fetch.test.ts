import assert from "node:assert/strict"
import { test } from "node:test"
import { isPrivateAddress, isPrivateHost, safeFetch, UnsafeUrlError } from "./safe-fetch.ts"

test("private, loopback, link-local and reserved addresses are recognised", () => {
  for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
    assert.equal(isPrivateAddress(a), true, a)
  }
  for (const a of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"]) assert.equal(isPrivateAddress(a), false, a)
  assert.equal(isPrivateHost("localhost"), true)
  assert.equal(isPrivateHost("db.internal"), true)
})

test("internal destinations are refused before any request is made", async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return new Response("secret")
  }) as typeof fetch
  try {
    for (const u of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://localhost:3000/admin", "http://[::1]/", "file:///etc/passwd", "ftp://example.com/", "http://example.com:6379/", "http://user:pass@example.com/"]) {
      await assert.rejects(safeFetch(u), UnsafeUrlError, u)
    }
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = original
  }
})

test("a redirect to an internal address is refused", async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })) as typeof fetch
  try {
    await assert.rejects(safeFetch("http://8.8.8.8/"), UnsafeUrlError)
  } finally {
    globalThis.fetch = original
  }
})

test("a public redirect is followed and the final URL is reported", async () => {
  const original = globalThis.fetch
  let n = 0
  globalThis.fetch = (async () => (n++ === 0 ? new Response(null, { status: 301, headers: { location: "https://1.1.1.1/home" } }) : new Response("ok"))) as typeof fetch
  try {
    const res = await safeFetch("http://8.8.8.8/")
    assert.equal(await res.text(), "ok")
    assert.equal(res.url, "https://1.1.1.1/home")
  } finally {
    globalThis.fetch = original
  }
})
