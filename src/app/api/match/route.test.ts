import { describe, expect, it } from "vitest";
import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/match", () => {
  it("returns ranked matches for valid skills", async () => {
    const res = await POST(makeRequest({ skills: ["coding", "problem-solving"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThan(0);
    expect(data.matches[0].career.id).toBe("software-engineer");
    expect(data.matches[0].score).toBeGreaterThan(0);
  });

  it("rejects a non-array skills field", async () => {
    const res = await POST(makeRequest({ skills: "coding" }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown skill ids", async () => {
    const res = await POST(makeRequest({ skills: ["flying"] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("flying");
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
