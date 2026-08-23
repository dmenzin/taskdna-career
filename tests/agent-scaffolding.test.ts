// Tests for the agent scaffolding's INVARIANTS, not for any model's quality.
//
// No model ran in this research run. These verify that the boundary would record what a real
// experiment needs, and that the rules keeping an agent's assertion from becoming truth are
// actually enforced.
import { describe, expect, it } from "vitest";
import {
  applyCorrection,
  diffBlueprints,
  hashSource,
  scorableClaims,
  type CareerBlueprint,
  type Claim,
  type ClaimChannel,
  type ClaimType,
  type WorkContent,
} from "@/agent/blueprint";
import { EchoProvider, InstrumentedRunner, PROMPTS, cacheKeyFor } from "@/agent/runtime";

const content: WorkContent = {
  action: "diagnose", object: "intermittent equipment failure", purpose: "restore production uptime",
  method: "structured elimination", inputs: ["sensor logs"], outputs: ["root cause report"], tools: ["oscilloscope"],
  domainContext: "discrete manufacturing", operatingEnvironment: "plant floor", stakeholders: ["maintenance"],
  ownership: "led", depth: "deep", decisionConsequence: "line stoppage", transferableWorkflow: ["anomaly", "evidence", "hypothesis", "test", "cause"],
};

function claim(id: string, channel: ClaimChannel, type: ClaimType): Claim {
  return {
    id, channel, type, content, stance: null, evidenceIds: ["ev-1"], confidence: 0.7, contradicts: [],
    provenance: { provider: "p", model: "m", promptId: "discover-work-content", promptVersion: "v1", blueprintVersion: 1, inputHash: "h" },
  };
}

function blueprint(claims: Claim[]): CareerBlueprint {
  return {
    schemaVersion: "career-blueprint.v1", personId: "p1", version: 1, createdAt: "2026-01-01T00:00:00.000Z",
    sourceHash: hashSource([{ id: "ev-1", text: "text" }]), claims, abstentions: [],
    provenance: { provider: "p", model: "m", promptId: "discover-work-content", promptVersion: "v1", costUsd: null, latencyMs: 0 },
  };
}

describe("claim type governs what may inform a score", () => {
  it("a transfer hypothesis never counts as experience", () => {
    const bp = blueprint([claim("c1", "experience", "TRANSFER_HYPOTHESIS"), claim("c2", "experience", "SUPPORTED_FACT")]);
    expect(scorableClaims(bp, "experience").map((c) => c.id)).toEqual(["c2"]);
  });

  it("a transfer hypothesis MAY inform direction, which is what it is for", () => {
    const bp = blueprint([claim("c1", "direction", "TRANSFER_HYPOTHESIS")]);
    expect(scorableClaims(bp, "direction").map((c) => c.id)).toEqual(["c1"]);
  });

  it("a user-rejected claim is suppressed on every channel", () => {
    const bp = blueprint([claim("c1", "preference", "USER_REJECTED"), claim("c2", "preference", "INTERPRETATION")]);
    expect(scorableClaims(bp, "preference").map((c) => c.id)).toEqual(["c2"]);
  });

  it("channels never leak into one another", () => {
    const bp = blueprint([claim("c1", "experience", "SUPPORTED_FACT"), claim("c2", "preference", "SUPPORTED_FACT")]);
    expect(scorableClaims(bp, "experience").map((c) => c.id)).toEqual(["c1"]);
    expect(scorableClaims(bp, "preference").map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("a published blueprint is immutable", () => {
  it("a correction produces a new version and leaves the original untouched", () => {
    const original = blueprint([claim("c1", "experience", "INTERPRETATION")]);
    const corrected = applyCorrection(original, { claimId: "c1", verdict: "CONFIRM" }, "2026-02-02T00:00:00.000Z");

    expect(original.version).toBe(1);
    expect(original.claims[0]!.type).toBe("INTERPRETATION");
    expect(corrected.version).toBe(2);
    expect(corrected.claims[0]!.type).toBe("USER_CONFIRMED");
  });

  it("a rejection is recorded as a retype, not as an unrelated add and remove", () => {
    const before = blueprint([claim("c1", "experience", "INTERPRETATION")]);
    const after = applyCorrection(before, { claimId: "c1", verdict: "REJECT" }, "2026-02-02T00:00:00.000Z");
    const diff = diffBlueprints(before, after);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.retyped).toHaveLength(1);
    expect(diff.retyped[0]!.after.type).toBe("USER_REJECTED");
  });
});

describe("the model boundary records what an experiment needs", () => {
  const decoding = { temperature: 0, maxOutputTokens: 512 };
  const request = { prompt: PROMPTS["discover-work-content.v1"]!, input: { evidenceText: "I diagnosed line failures." }, decoding };

  it("every behaviour-changing input participates in the cache key", () => {
    const provider = new EchoProvider();
    const base = cacheKeyFor(provider, request);

    // A different prompt version must not reuse the cached result.
    const bumped = cacheKeyFor(provider, { ...request, prompt: { ...request.prompt, version: "v2" } });
    expect(bumped).not.toBe(base);

    // Nor may different decoding parameters.
    const hotter = cacheKeyFor(provider, { ...request, decoding: { ...decoding, temperature: 0.7 } });
    expect(hotter).not.toBe(base);

    // Nor different input.
    const other = cacheKeyFor(provider, { ...request, input: { evidenceText: "Something else." } });
    expect(other).not.toBe(base);
  });

  it("key order in the input does not change the key", () => {
    const provider = new EchoProvider();
    const a = cacheKeyFor(provider, { ...request, input: { a: 1, b: 2 } });
    const b = cacheKeyFor(provider, { ...request, input: { b: 2, a: 1 } });
    expect(a).toBe(b);
  });

  it("identical work is interpreted once and reused, so cost cannot scale with people times jobs", async () => {
    const runner = new InstrumentedRunner(new EchoProvider());
    await runner.run(request);
    await runner.run(request);
    await runner.run(request);

    const telemetry = runner.telemetry();
    expect(telemetry.calls).toBe(3);
    expect(telemetry.cacheMisses).toBe(1);
    expect(telemetry.cacheHits).toBe(2);
  });

  it("cost is never invented when the provider does not report it", async () => {
    const runner = new InstrumentedRunner(new EchoProvider());
    const { record } = await runner.run(request);
    expect(record.usage.costUsd).toBeNull();
    expect(record.usage.costIsEstimate).toBe(false);
  });

  it("every registered prompt carries a version and a falsifiable hypothesis", () => {
    for (const [key, spec] of Object.entries(PROMPTS)) {
      expect(spec.version, key).toMatch(/^v\d+$/);
      expect(spec.hypothesis.length, key).toBeGreaterThan(40);
      expect(key).toBe(`${spec.id}.${spec.version}`);
    }
  });
});
