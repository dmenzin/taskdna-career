import { describe, expect, it } from "vitest";
import {
  CAREERS,
  SKILL_CATALOG,
  getSkillLabel,
  matchCareers,
} from "./careers";

describe("career dataset", () => {
  it("only references skill ids that exist in the catalog", () => {
    const known = new Set(SKILL_CATALOG.map((s) => s.id));
    for (const career of CAREERS) {
      for (const skillId of Object.keys(career.skills)) {
        expect(known.has(skillId), `${career.id} -> ${skillId}`).toBe(true);
      }
    }
  });

  it("has unique career and skill ids", () => {
    expect(new Set(CAREERS.map((c) => c.id)).size).toBe(CAREERS.length);
    expect(new Set(SKILL_CATALOG.map((s) => s.id)).size).toBe(
      SKILL_CATALOG.length,
    );
  });
});

describe("matchCareers", () => {
  it("scores every career from 0 to 100 with no selection", () => {
    const matches = matchCareers([]);
    expect(matches).toHaveLength(CAREERS.length);
    for (const m of matches) {
      expect(m.score).toBe(0);
      expect(m.matchedSkills).toHaveLength(0);
    }
  });

  it("returns results sorted by descending score", () => {
    const matches = matchCareers(["coding", "problem-solving", "ml", "data"]);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it("ranks the obvious career first for a focused skill set", () => {
    const matches = matchCareers(["coding", "problem-solving", "systems"]);
    expect(matches[0].career.id).toBe("software-engineer");
    expect(matches[0].score).toBeGreaterThan(80);
  });

  it("gives a perfect score when all of a career's skills are selected", () => {
    const seChef = CAREERS.find((c) => c.id === "software-engineer")!;
    const matches = matchCareers(Object.keys(seChef.skills));
    const se = matches.find((m) => m.career.id === "software-engineer")!;
    expect(se.score).toBe(100);
    expect(se.growthSkills).toHaveLength(0);
  });

  it("caps growth skills at three per career", () => {
    for (const m of matchCareers(["coding"])) {
      expect(m.growthSkills.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("getSkillLabel", () => {
  it("resolves known ids to human labels", () => {
    expect(getSkillLabel("coding")).toBe("Coding");
  });

  it("falls back to the id for unknown skills", () => {
    expect(getSkillLabel("does-not-exist")).toBe("does-not-exist");
  });
});
