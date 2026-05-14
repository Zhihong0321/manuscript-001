# Design: Reading Analytics

## Overview

Add anonymous reading funnel tracking to the ebook. Track which chapters each browser reaches, deduplicate at both client and DB level, expose funnel data on an admin page.

No new dependencies. No abstractions. Just: cookie → IntersectionObserver → POST → PostgreSQL → admin query.

## Architecture

```
Browser (app.js)                    Server (server.js)              PostgreSQL
─────────────────                   ──────────────────              ──────────
1. Get/create browser_id cookie
2. IntersectionObserver fires  ──→  POST /api/reading-progress  ──→  INSERT ... ON CONFLICT DO NOTHING
   when chapter heading visible      validates, returns 201/200       read_progress table
                                                                      UNIQUE(browser_id, chapter)
Admin (reading.html)
─────────────────────
3. Login with password         ──→  GET /api/admin/reading      ──→  COUNT per chapter, compute drop-off %
   Render funnel table
```

## Components and Interfaces

### 1. Client tracking (bottom of `ebook/js/app.js`)

New IIFE section — "READING ANALYTICS MODULE":

- `getBrowserId()`: reads `browser_id` cookie. If missing or invalid UUID v4, generates one via `crypto.randomUUID()`, sets cookie with 365-day expiry. Returns the ID.
- `reportChapter(chapterId)`: POSTs to `/api/reading-progress`. Maintains a `Set` of already-reported chapters this session. Skips if already reported. Fire-and-forget (no error handling shown to user).
- IntersectionObserver (threshold 0.5) on elements matching `.chapter-header` inside the reader. On intersect, maps the DOM chapter ID to the analytics ID and calls `reportChapter`.

Chapter ID mapping (hardcoded object):
```js
const CHAPTER_MAP = {
  preface: null, // not tracked
  opening: 'opening',
  ch1: 'chapter_01', ch2: 'chapter_02', ch3: 'chapter_03',
  ch4: 'chapter_04', ch5: 'chapter_05', ch6: 'chapter_06',
  ch7: 'chapter_07', ch8: 'chapter_08', ch9: 'chapter_09',
  extra: 'bonus',
  ch10: 'chapter_10', ch11: 'chapter_11', ch12: 'chapter_12',
  afterword: 'afterword',
  support: 'payment'
};
```

### 2. API routes (added directly in `ebook/api/server.js`)

**POST `/api/reading-progress`** (public, no auth):
- Validate `browser_id` is UUID v4 format (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`)
- Validate `chapter` is in the allowed list
- INSERT with ON CONFLICT (browser_id, chapter) DO NOTHING
- Return 201 if inserted (rowCount === 1), 200 if duplicate

**GET `/api/admin/reading`** (protected by `requireAdmin`):
- Query: count distinct browser_id per chapter
- Compute drop-off % between consecutive chapters
- Return JSON array in reading order

### 3. Database table (added to `initDB()` in server.js)

```sql
CREATE TABLE IF NOT EXISTS read_progress (
  id SERIAL PRIMARY KEY,
  browser_id VARCHAR(100) NOT NULL,
  chapter VARCHAR(100) NOT NULL,
  reached_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(browser_id, chapter)
);
```

### 4. Admin page (`ebook/admin/reading.html`)

Same pattern as `reviews.html`: login box → fetch with `X-Admin-Password` header → render table. Shows:
- Chapter name (in reading order)
- Readers count
- Drop-off from previous chapter (count and %)
- Highlighted row if drop-off % exceeds mean + 10 points

## Data Models

### read_progress table

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| browser_id | VARCHAR(100) | NOT NULL |
| chapter | VARCHAR(100) | NOT NULL |
| reached_at | TIMESTAMP | DEFAULT NOW() |
| — | — | UNIQUE(browser_id, chapter) |

### POST /api/reading-progress request body

```json
{ "browser_id": "uuid-v4-string", "chapter": "chapter_01" }
```

### GET /api/admin/reading response

```json
[
  { "chapter": "opening", "readers": 142, "dropoff": 0, "dropoff_pct": 0.0, "highlight": false },
  { "chapter": "chapter_01", "readers": 98, "dropoff": 44, "dropoff_pct": 31.0, "highlight": true },
  ...
]
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: UUID v4 validation rejects invalid strings

*For any* string that does not match the UUID v4 format (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`), the API SHALL return 400 and the client SHALL discard it and generate a new valid UUID.

**Validates: Requirements 1.3, 4.3**

### Property 2: Client-side session deduplication

*For any* sequence of chapter intersection events within a single page session, each unique chapter SHALL produce at most one POST request — subsequent observations of the same chapter are silently skipped.

**Validates: Requirements 2.2**

### Property 3: API insert-or-deduplicate

*For any* valid (browser_id, chapter) pair, the first insertion SHALL return 201 and create exactly one row; any subsequent insertion of the same pair SHALL return 200 and not create additional rows.

**Validates: Requirements 3.1, 3.3, 4.1**

### Property 4: Invalid chapter rejection

*For any* string that is not in the defined chapter list, the API SHALL return 400 and not insert any row.

**Validates: Requirements 4.2**

### Property 5: Drop-off percentage calculation

*For any* two consecutive chapters where the previous chapter has > 0 readers, the drop-off percentage SHALL equal `((prev_readers - current_readers) / prev_readers) * 100` rounded to one decimal place.

**Validates: Requirements 5.2**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Client POST fails (network error) | Silently swallowed, no UI error |
| Invalid browser_id in POST body | 400 `{ "error": "Invalid browser_id" }` |
| Invalid chapter in POST body | 400 `{ "error": "Invalid chapter" }` |
| DB unavailable on POST | 500 `{ "error": "Internal server error" }` |
| Admin endpoint without/wrong password | 401 `{ "error": "Unauthorized" }` (existing `requireAdmin`) |
| No data in admin query | Return all chapters with 0 readers |

## Testing Strategy

**Unit tests** (example-based):
- `getBrowserId()` returns valid UUID when no cookie exists
- `getBrowserId()` reuses existing valid cookie
- POST endpoint returns 201 for new pair, 200 for duplicate
- POST endpoint returns 400 for invalid inputs
- Admin endpoint returns correct funnel structure
- Admin endpoint returns 401 without password
- Empty DB returns all chapters with zero counts

**Property tests** (fast-check, 100+ iterations each):
- Property 1: Generate random non-UUID strings → API returns 400
- Property 2: Generate random chapter event sequences → Set-based dedup produces correct POST count
- Property 3: Generate random valid (browser_id, chapter) pairs → insert twice, verify idempotent behavior
- Property 4: Generate random strings not in chapter list → API returns 400
- Property 5: Generate random reader count arrays → verify drop-off formula

Library: `fast-check` (already available in Node ecosystem, zero-config)
Tag format: `Feature: reading-analytics, Property {N}: {description}`
