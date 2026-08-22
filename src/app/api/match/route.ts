import { NextResponse } from "next/server";
import { matchCareers, SKILL_CATALOG } from "@/lib/careers";

const VALID_SKILL_IDS = new Set(SKILL_CATALOG.map((s) => s.id));

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const skills = (body as { skills?: unknown })?.skills;

  if (!Array.isArray(skills) || !skills.every((s) => typeof s === "string")) {
    return NextResponse.json(
      { error: "`skills` must be an array of skill id strings." },
      { status: 400 },
    );
  }

  const invalid = skills.filter((s) => !VALID_SKILL_IDS.has(s));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown skill id(s): ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  const matches = matchCareers(skills);
  return NextResponse.json({ count: matches.length, matches });
}
