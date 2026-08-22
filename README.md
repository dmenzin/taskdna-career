# taskdna-career

Help people find their dream jobs.

TaskDNA Career is a web app that matches people to careers based on their unique
"skill DNA." Pick the strengths that feel most like you and get an instant,
ranked list of careers where you'll thrive — complete with fit scores, salary
ranges, market demand, and the skills to grow into next.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [Vitest](https://vitest.dev/) for unit/API tests

## Getting started

```bash
npm ci          # install dependencies
npm run dev     # start the dev server at http://localhost:3000
```

## Common commands

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the Next.js dev server (port 3000)      |
| `npm run build`     | Create an optimized production build          |
| `npm start`         | Serve the production build                     |
| `npm run lint`      | Run ESLint                                     |
| `npm run typecheck` | Type-check with `tsc --noEmit`                |
| `npm test`          | Run the Vitest suite                           |

## Project structure

```
src/
  app/
    page.tsx              # Interactive "career DNA" UI
    layout.tsx            # Root layout + metadata
    api/
      match/route.ts      # POST: rank careers for a set of skills
      careers/route.ts    # GET: full skill + career catalog
  lib/
    careers.ts            # Career dataset + matching algorithm
    careers.test.ts       # Matching-logic tests
```

## API

`POST /api/match`

```jsonc
// request
{ "skills": ["coding", "problem-solving", "systems"] }

// response
{
  "count": 12,
  "matches": [
    {
      "career": { "id": "software-engineer", "title": "Software Engineer", ... },
      "score": 93,
      "matchedSkills": ["coding", "problem-solving", "systems"],
      "growthSkills": ["communication"]
    }
    // ...
  ]
}
```

`GET /api/careers` returns the full `{ skills, careers }` catalog.

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent dev environment: `npm ci`
installs dependencies and the `dev` terminal runs `npm run dev` on port 3000.
