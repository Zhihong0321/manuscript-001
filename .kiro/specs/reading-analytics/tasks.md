# Implementation Plan: Reading Analytics

## Overview

Add anonymous reading funnel tracking: DB table, two API routes, client-side tracking in app.js, and an admin page. All changes go into existing files except the new admin HTML page.

## Tasks

- [x] 1. Add read_progress table and API routes to server.js
  - [x] 1.1 Add `read_progress` table creation to `initDB()` in `ebook/api/server.js`
    - Add CREATE TABLE IF NOT EXISTS with columns: id SERIAL PRIMARY KEY, browser_id VARCHAR(100) NOT NULL, chapter VARCHAR(100) NOT NULL, reached_at TIMESTAMP DEFAULT NOW(), UNIQUE(browser_id, chapter)
    - _Requirements: 6.1, 6.2, 6.3, 3.2_

  - [x] 1.2 Add POST `/api/reading-progress` route to `ebook/api/server.js`
    - Validate browser_id is UUID v4 format, return 400 if invalid
    - Validate chapter is in the allowed list, return 400 if invalid
    - INSERT with ON CONFLICT (browser_id, chapter) DO NOTHING
    - Return 201 if inserted (rowCount === 1), 200 if duplicate
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.1, 3.3_

  - [x] 1.3 Add GET `/api/admin/reading` route to `ebook/api/server.js`
    - Protected by existing `requireAdmin` middleware
    - Query COUNT(DISTINCT browser_id) per chapter
    - Compute drop-off count and percentage between consecutive chapters
    - Return JSON array in reading order with chapter, readers, dropoff, dropoff_pct, highlight fields
    - Highlight if drop-off % exceeds mean + 10 points
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [~] 2. Checkpoint
  - Ensure the server starts without errors, ask the user if questions arise.

- [ ] 3. Add reading analytics tracking to frontend
  - [-] 3.1 Add reading analytics IIFE module to bottom of `ebook/js/app.js`
    - `getBrowserId()`: read/create `browser_id` cookie (UUID v4, 365-day expiry)
    - `reportChapter(chapterId)`: POST to `/api/reading-progress`, skip if already reported this session (Set-based dedup)
    - IntersectionObserver (threshold 0.5) on `.chapter-header` elements, map DOM chapter IDs to analytics IDs via CHAPTER_MAP
    - Fire-and-forget: silently swallow network errors
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4. Create admin reading dashboard page
  - [-] 4.1 Create `ebook/admin/reading.html`
    - Same pattern as existing `ebook/admin/reviews.html`: login box, fetch with `X-Admin-Password` header, render table
    - Show chapter name, readers count, drop-off count, drop-off %, highlighted rows for high drop-off
    - Display chapters in reading order, show zeros when no data
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [~] 5. Final checkpoint
  - Ensure all components work together, ask the user if questions arise.

## Notes

- All server changes go in `ebook/api/server.js` (same file, same pattern as reviews)
- All frontend tracking goes in `ebook/js/app.js` as a new IIFE at the bottom
- Admin page follows the exact same pattern as `ebook/admin/reviews.html`
- No new dependencies needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["3.1", "4.1"] }
  ]
}
```
