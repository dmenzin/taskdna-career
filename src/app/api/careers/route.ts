import { NextResponse } from "next/server";
import { CAREERS, SKILL_CATALOG } from "@/lib/careers";

export async function GET() {
  return NextResponse.json({
    skills: SKILL_CATALOG,
    careers: CAREERS,
  });
}
