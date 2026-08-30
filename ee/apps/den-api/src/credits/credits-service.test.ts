import { describe, expect, mock, test } from "bun:test"

mock.module("../db.js", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    insert: () => ({ values: () => Promise.resolve() }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}))

const {
  TIER_MULTIPLIERS,
  InsufficientCreditsError,
  tierMultiplier,
} = await import("./credits-service.js")

describe("credits service — tier multipliers", () => {
  test("free tier has 1.0 multiplier", () => {
    expect(tierMultiplier("free")).toBe(1.0)
  })

  test("pro tier has 0.8 multiplier", () => {
    expect(tierMultiplier("pro")).toBe(0.8)
  })

  test("enterprise tier has 0.6 multiplier", () => {
    expect(tierMultiplier("enterprise")).toBe(0.6)
  })

  test("unknown tier defaults to 1.0", () => {
    expect(tierMultiplier("unknown")).toBe(1.0)
  })

  test("TIER_MULTIPLIERS exports all three tiers", () => {
    expect(TIER_MULTIPLIERS.free).toBe(1.0)
    expect(TIER_MULTIPLIERS.pro).toBe(0.8)
    expect(TIER_MULTIPLIERS.enterprise).toBe(0.6)
  })
})

describe("credits service — InsufficientCreditsError", () => {
  test("constructs with balance and requested", () => {
    const err = new InsufficientCreditsError(50, 100)
    expect(err.balance).toBe(50)
    expect(err.requested).toBe(100)
    expect(err.message).toContain("50")
    expect(err.message).toContain("100")
    expect(err.name).toBe("InsufficientCreditsError")
  })

  test("is an Error instance", () => {
    const err = new InsufficientCreditsError(0, 10)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(InsufficientCreditsError)
  })
})

describe("credits service — effective deduction math", () => {
  test("free tier: 100 credits * 1.0 = 100", () => {
    expect(Math.ceil(100 * tierMultiplier("free"))).toBe(100)
  })

  test("pro tier: 100 credits * 0.8 = 80", () => {
    expect(Math.ceil(100 * tierMultiplier("pro"))).toBe(80)
  })

  test("enterprise tier: 100 credits * 0.6 = 60", () => {
    expect(Math.ceil(100 * tierMultiplier("enterprise"))).toBe(60)
  })

  test("pro tier: 7 credits * 0.8 = 6 (ceil(5.6))", () => {
    expect(Math.ceil(7 * tierMultiplier("pro"))).toBe(6)
  })
})
