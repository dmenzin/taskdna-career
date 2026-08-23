# Four parallel channels: the product scope

A PERSON has four independent evidence collections:

- **Preferences** — what work they like and dislike
- **Experience** — what work they have actually performed
- **Qualifications** — structured credentials, skills, education
- **Direction / Aspirations** — what work they explicitly want to do next

These are **parallel independent channels**, not stages of one pipeline and not inputs to a
single blended score.

## Four different questions

| channel | question |
| --- | --- |
| Preference Fit | Does the job contain work the person likes or dislikes? |
| Experience Fit | Does the job contain work the person has actually performed? |
| Direction Fit | Does the job contain work the person explicitly wants to do next? |
| Qualification Fit | Does the person's structured qualification evidence meet the job's requirements? |

## Shared infrastructure, distinct semantics

Preference evidence, experience evidence, direction evidence, and job responsibilities all map
onto the same canonical work vocabulary through the same mapper (`src/v3/mapper.ts`). That is
deliberate: it is what lets "I enjoy root-cause investigation" be compared against a job
responsibility at all.

Sharing the mapper does **not** mean sharing semantics. `tests/four-channel-parallel.test.ts`
asserts both halves: the same source text through three channels produces one identical
`cacheKey` (shared infrastructure) and three differently-scored channels (distinct semantics).

## The four non-implications

Each is a separate test in `tests/four-channel-parallel.test.ts`.

**Experience must not imply Direction.** A career tool that reads "has done" as "wants to do"
recommends people straight back into the work they are trying to leave.

**Direction must not imply Experience.** Reading "wants to do" as "has done" recommends work
the person cannot currently get, and overstates their candidacy.

**Experience must not imply Preference.** The burned-out expert is the canonical case: deep
experience, strongly negative preference. There is a dedicated test where both channels stay
intact and opposed.

**Preference must not imply Experience.** Wanting work is not having done it.

Two further invariants are asserted alongside them: Qualification is independent of all three
work-content channels (liking, having done, and wanting the work satisfies no requirement), and
occupation/title context creates no evidence in any channel.

## Both directions are first-class workstreams

The autonomous loop must continuously pursue **both**:

```
experience  ->  relevant jobs
direction   ->  relevant jobs
```

as parallel optimization and evaluation workstreams. Workstream 5 (Experience Fit) and
workstream 7 (Direction Fit) in `config/research-portfolio.json` are separate entries with
separate uncertainties, hypotheses, and next experiments. Neither may be treated as derived
from the other.

Direction is currently the least-evidenced channel: aspiration language is rare in resume-style
text. That is recorded as workstream 7's largest uncertainty, with the working hypothesis that
direction requires its own elicitation rather than extraction from resumes — resumes describe
the past.

## No Overall V3 score

`scoreV3` returns exactly four keys and nothing else. A test asserts the key set is
`["direction", "experience", "preference", "qualification"]` and that no key matches
`/overall|combined|total|composite/i`.

Four numbers that mean four different things are more useful to a person deciding about a job
than one number that means none of them. Collapsing them would also destroy the burned-out
expert and career-changer cases above, which are precisely the people this product is for.

## Related

- `src/v3/fit.ts` — the four channel scorers
- `src/v3/strategy.ts` — replaceable boundaries; channel scorers pinned to `DETERMINISTIC_ARITHMETIC`
- `docs/V3_COMPUTATIONAL_CONTRACT.md` — the no-overall-score contract
