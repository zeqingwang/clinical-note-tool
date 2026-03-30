## Clinical Note Tool (Next.js + MongoDB + GPT)

This app ingests clinical documents, structures key clinical fields, generates an HPI narrative, and stores a versioned HPI history per case. It also supports importing MCG-style criteria documents (mapped by disease/pathway) separately from cases.

## Basic Functions (User Instructions)

### Cases (clinical documents + HPI workflow)
Open `/cases`.

1. Create a new case: `/cases/new`.
2. Upload clinical documents (PDF or DOCX) for the case.
3. The system auto-classifies document type (ER_NOTE / HP_NOTE / OTHER), extracts text, and produces `structuredRawData`.
4. In the case page, click `Generate HPI` to create an HPI and append it to the `generatedHPI` history.
5. For each generated HPI entry:
   - `Review` runs a payer/UM score + missing points + inconsistencies + improvements.
   - `Regenerate review` regenerates a new HPI using the review output.
   - `Regenerate HPI`based on the review, user can select the point at to the prompt, and also manually input, to regenerate a new version of HPI.
   - `Edit` allows direct modification with a simple choice:
     - `Update this HPI`: modifies the current entry, sets `type: human_revise`, and clears score/review fields.
     - `Save as new HPI`: creates a new entry with `type: human_revise` and clears score/review fields for the new one.
   - `Delete` removes the entry from history.
6. `Auto generate loop` runs a hybrid loop (generate 2 candidates, review both, then refine up to 10 times with early stopping). It saves only the final best-scoring HPI once.

### MCG criteria (separate from cases)
Open `/mcg`.

1. Upload an MCG guideline PDF or DOCX.
2. The system extracts a structured JSON criteria map keyed by disease/pathway identifiers.
3. View the extracted criteria in `/mcg/[id]`.

## Setup

### Prerequisites
- Node.js (Node 20+ recommended)
- MongoDB connection string
- OpenAI API key

### Environment variables
Create `.env.local` with:

```bash
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_key
```

### Local dev
```bash
npm install
npm run dev
```
Then open `http://localhost:3000`.

## Architecture Overview

### Frontend
- Next.js App Router under `src/app/`
- Case UI:
  - `src/app/cases/[id]/page.tsx`: loads case detail and renders main sections
  - `src/app/cases/[id]/merged-hpi-summary.tsx`: HPI generation/review/regenerate/edit UI

### Backend (API routes)
- `src/app/api/cases/[id]/ingest/route.ts`: upload PDFs/DOCX and structure into `structuredRawData`
- `src/app/api/cases/[id]/generate-hpi/route.ts`: generate HPI and append to `generatedHPI`
- `src/app/api/cases/[id]/generated-hpi/route.ts`:
  - `DELETE` deletes an HPI entry
  - `PATCH` edits an HPI entry (update current or save new)
- `src/app/api/cases/[id]/generated-hpi/review/route.ts`: payer/UM review stored as `score` + `improvement`
- `src/app/api/cases/[id]/regenerate-hpi/route.ts`: regenerates using review instructions
- `src/app/api/cases/[id]/auto-generate-hpi-loop/route.ts`: server-side loop; saves only the final HPI

### Core libraries
- HPI generation: `src/lib/generate-hpi-from-summary-gpt.ts`
- Review: `src/lib/generate-hpi-review-gpt.ts`
- Regeneration: `src/lib/generate-hpi-regenerate-gpt.ts`
- Auto-loop orchestration (in-memory): `src/lib/auto-hpi-loop.ts`
- MongoDB persistence: `src/lib/cases-db.ts`

### MCG extraction
- `src/lib/structure-mcg-gpt.ts` and `src/lib/mcg-db.ts`
- UI: `src/app/mcg/page.tsx` and `src/app/mcg/[id]/page.tsx`

## Deploy to AWS Amplify

### 1) Connect your repo
1. AWS Amplify Console -> Create app
2. Connect Git provider (GitHub, GitLab, etc.)
3. Select branch (e.g. `main`)

### 2) Build settings (typical for Next.js)
Set:
- Build command: `npm run build`
- Start command: `npm run start`

Amplify usually detects Next.js automatically; if not, choose the Next.js framework preset.

### 3) Configure environment variables in Amplify
Add:
- `MONGODB_URI`
- `OPENAI_API_KEY`


Then redeploy.
