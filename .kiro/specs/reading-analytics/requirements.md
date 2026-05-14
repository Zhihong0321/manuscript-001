# Requirements Document

## Introduction

Anonymous reading funnel analytics for ganzhihong.com. Track which chapters readers reach using a browser cookie, store progress in PostgreSQL, and show drop-off data on a simple admin dashboard.

## Glossary

- **System**: The ganzhihong.com ebook application (frontend + Express API + PostgreSQL)
- **Browser_ID**: A random UUID stored as a cookie in the reader's browser, persisting 365 days, containing no personal data
- **Chapter**: One of the ordered content sections tracked for analytics: opening, chapter_01–chapter_09, bonus, chapter_10–chapter_12, afterword, payment
- **Read_Progress**: A PostgreSQL table recording which chapters each Browser_ID has reached
- **Admin_Dashboard**: A protected HTML page at /admin/reading showing funnel analytics
- **Drop_Off_Rate**: The percentage of readers who reached a chapter but did not reach the next chapter

## Requirements

### Requirement 1: Browser ID Cookie

**User Story:** As the site owner, I want each visitor to get a persistent anonymous ID, so that I can track reading progress without collecting personal data.

#### Acceptance Criteria

1. WHEN a visitor loads the site without an existing Browser_ID cookie, THE System SHALL generate a UUID v4 value and set it as a cookie named `browser_id` with a 365-day expiry from the current date
2. WHEN a visitor loads the site with an existing `browser_id` cookie containing a valid UUID v4 value, THE System SHALL reuse the existing cookie value
3. IF a visitor loads the site with an existing `browser_id` cookie that does not contain a valid UUID v4 value, THEN THE System SHALL discard the invalid value, generate a new UUID v4, and set it as the `browser_id` cookie with a 365-day expiry
4. THE System SHALL store no personal data (no IP addresses, no names, no device fingerprints) in the cookie or associated database records

### Requirement 2: Chapter Reach Tracking

**User Story:** As the site owner, I want to know when a reader reaches each chapter, so that I can see how far people read.

#### Acceptance Criteria

1. WHEN a chapter heading enters the viewport (IntersectionObserver threshold of 0.5), THE System SHALL send a POST request to `/api/reading-progress` with a JSON body containing the `browser_id` and `chapter` values
2. THE System SHALL send each chapter reach event only once per page session per chapter, skipping the POST if that chapter was already reported during the current session
3. THE System SHALL track chapters using these ordered identifiers: opening, chapter_01, chapter_02, chapter_03, chapter_04, chapter_05, chapter_06, chapter_07, chapter_08, chapter_09, bonus, chapter_10, chapter_11, chapter_12, afterword, payment
4. IF the POST request fails or the network is unavailable, THEN THE System SHALL silently discard the event without displaying an error to the reader
5. THE System SHALL function on both mobile and desktop viewports in browsers supporting IntersectionObserver

### Requirement 3: Deduplication

**User Story:** As the site owner, I want each chapter recorded only once per browser, so that re-reads don't inflate the numbers.

#### Acceptance Criteria

1. WHEN the API receives a chapter-reached event for a Browser_ID and chapter combination that already exists in the Read_Progress table, THE System SHALL not insert a new record and SHALL return a 200 success response
2. THE Read_Progress table SHALL enforce uniqueness on the (browser_id, chapter) pair via a UNIQUE constraint so that concurrent duplicate requests do not result in multiple rows
3. WHEN the API receives a chapter-reached event for a Browser_ID and chapter combination that does not yet exist, THE System SHALL insert exactly one record into the Read_Progress table and return a 201 response

### Requirement 4: API Endpoint

**User Story:** As the site owner, I want a simple API endpoint to receive and store reading progress.

#### Acceptance Criteria

1. WHEN a POST request is received at `/api/reading-progress` with a JSON body containing `browser_id` (valid UUID v4 format) and `chapter` (a value in the defined chapter list), THE System SHALL insert a row into the read_progress table and return a 201 response
2. IF the chapter value is not in the defined chapter list, THEN THE System SHALL return a 400 response with a JSON error message
3. IF the browser_id field is missing, empty, or not a valid UUID v4 format, THEN THE System SHALL return a 400 response with a JSON error message
4. IF the database is unavailable, THEN THE System SHALL return a 500 response with a JSON error message

### Requirement 5: Admin Dashboard

**User Story:** As the site owner, I want a simple funnel view showing how many readers reach each chapter and where they drop off.

#### Acceptance Criteria

1. WHEN an admin sends a GET request to `/api/admin/reading` with a valid `x-admin-password` header, THE System SHALL return JSON data showing each chapter, total unique readers who reached it, drop-off count from previous chapter, and drop-off percentage
2. THE Admin_Dashboard SHALL calculate drop-off percentage as: ((readers of previous chapter − readers of current chapter) / readers of previous chapter) × 100, rounded to one decimal place
3. WHEN a chapter has a drop-off percentage that exceeds the mean drop-off percentage by 10 or more percentage points, THE Admin_Dashboard SHALL visually highlight that row with a distinct background color
4. THE Admin_Dashboard SHALL display chapters in the defined reading order
5. IF the `x-admin-password` header is missing or incorrect, THEN THE System SHALL return HTTP 401
6. IF no reading data exists, THEN THE Admin_Dashboard SHALL display the chapter list with zero readers and zero drop-off for each row

### Requirement 6: Data Storage

**User Story:** As the site owner, I want reading progress stored in PostgreSQL alongside my existing data.

#### Acceptance Criteria

1. THE System SHALL store reading progress in a `read_progress` table with columns: id (SERIAL PRIMARY KEY), browser_id (VARCHAR(100) NOT NULL), chapter (VARCHAR(100) NOT NULL), reached_at (TIMESTAMP DEFAULT NOW())
2. WHEN the API process starts, THE System SHALL create the read_progress table if it does not already exist, using the same initialization pattern as the existing reviews table
3. THE System SHALL add a UNIQUE constraint on (browser_id, chapter) to enforce deduplication at the database level
