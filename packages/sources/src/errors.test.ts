import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyError } from "./errors.ts"
import { decide } from "./match.ts"
import type { Place } from "@atrium/shared/types"

test("provider failures are told apart", () => {
  assert.equal(classifyError(Object.assign(new Error("x"), { status: 402 })), "out_of_credits")
  assert.equal(classifyError(new Error("ScrapeCreators 402 en /v1/instagram/profile")), "out_of_credits")
  assert.equal(classifyError(new Error("ScrapeCreators 429 en /v1/google/search")), "rate_limited")
  assert.equal(classifyError(Object.assign(new Error("x"), { status: 404 })), "not_found")
  assert.equal(classifyError(Object.assign(new Error("x"), { name: "TimeoutError" })), "timeout")
  assert.equal(classifyError(new Error("something else")), "unknown")
  assert.equal(classifyError(null), "unknown")
})

const place = (id: string, name: string, address: string, reviews: number): Place => ({
  id, name, address, lat: 0, lng: 0, rating: 4.5, reviews, website: null, primaryType: null, mapsUrl: null,
})

test("a franchise asks the user to choose, busiest location first", () => {
  const d = decide("Taco Naco", [
    place("a", "Taco Naco", "Carolina, Puerto Rico", 1261),
    place("b", "TACO NACO KC", "Overland Park, KS", 1514),
    place("c", "Taco Naco", "Kansas City, KS", 300),
  ])
  assert.equal(d.action, "ask")
  if (d.action === "ask") assert.deepEqual(d.options.map((p) => p.id), ["b", "a", "c"])
})

test("one clear match proceeds", () => {
  const d = decide("Katz's Delicatessen New York", [place("k", "Katz's Delicatessen", "205 E Houston St, New York, NY", 56000), place("x", "Other Deli", "Brooklyn, NY", 90)])
  assert.equal(d.action, "proceed")
})
