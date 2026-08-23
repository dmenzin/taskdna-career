// Tracked-file secret scan. The readiness gate used to treat ANY match as a failure, which
// made a deliberate hygiene fixture (`sk-test-SENTINEL-must-never-appear`) look like a leak.
// That trained people to accept 35/36. The scanner itself is unchanged; known fixtures are
// subtracted after the fact, and a match outside the allowlist still fails.

export const SECRET_PATTERN_SOURCE =
  "(AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,})";

/**
 * Paths that MAY contain a string matching the secret pattern, because they exist to prove
 * secrets do not leak. Keep this list short and named. Adding a production path here is the
 * failure mode this file exists to prevent.
 */
export const SECRET_SCAN_ALLOWLIST = [
  "tests/openai-provider.test.ts",
] as const;

export function unexpectedSecretMatches(
  paths: string[],
  allowlist: readonly string[] = SECRET_SCAN_ALLOWLIST,
): string[] {
  const allowed = new Set(allowlist);
  return [...new Set(paths.filter(Boolean).filter((path) => !allowed.has(path)))].sort();
}
