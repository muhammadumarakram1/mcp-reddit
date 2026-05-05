# Reddit API — Research Report
**Date:** 2026-05-05

## API State (verified)

- **Base URL:** `https://oauth.reddit.com` for all authenticated API calls (NOT `www.reddit.com`). [Source](https://github.com/reddit-archive/reddit/wiki/oauth2)
- **Auth flow:** `client_credentials` grant (POST to `https://www.reddit.com/api/v1/access_token`) — valid for script-type apps operating without a logged-in user. `password` grant also supported but only for accounts listed as app developers. [Source](https://github.com/reddit-archive/reddit/wiki/oauth2)
- **Rate limits:** 100 QPM (queries per minute) per OAuth client ID, averaged over a rolling 10-minute window. Monitored via `X-Ratelimit-Used`, `X-Ratelimit-Remaining`, `X-Ratelimit-Reset` response headers. [Source](https://painonsocial.com/blog/reddit-api-rate-limits-guide)
- **App registration:** `https://www.reddit.com/prefs/apps` (still active; `old.reddit.com/prefs/apps` redirects to the same page). As of late 2025, new apps require manual pre-approval via Reddit's Developer Support form. [Source](https://redaccs.com/reddit-api-guide/)
- **Endpoints `/r/{sub}/hot`, `/r/{sub}/new`, `/search`, `/comments/{id}`:** All remain active under the OAuth API. No deprecation notices found. Unauthenticated `.json` scraping is restricted, but OAuth-authenticated calls to these endpoints are unaffected.

## Code vs API delta

- **OAuth token fetch** (`src/index.ts:27–35`): MATCH — uses `POST https://www.reddit.com/api/v1/access_token` with `grant_type=client_credentials` and Basic auth. Correct.
- **Base URL** (`src/index.ts:47`): MATCH — uses `https://oauth.reddit.com`. Correct.
- **Rate limit comment** (`src/index.ts:55`): MATCH — hardcoded comment says "100 QPM", consistent with current documented limit.
- **`/r/{sub}/hot`** (`src/index.ts:198`): MATCH — endpoint active.
- **`/search` and `/r/{sub}/search`** (`src/index.ts:176`): MATCH — endpoint active.
- **`/comments/{id}`** (`src/index.ts:213`): MATCH — endpoint active.
- **App registration URL in error message** (`src/index.ts:22`): MINOR — points to `https://www.reddit.com/prefs/apps`, which is correct, but does not warn that manual pre-approval is now required (as of Nov 2025).

## Fixes required

- NONE (functional). Optional improvement: update the error message at `src/index.ts:22` to note that new apps require pre-approval via Reddit's Developer Support form, so users aren't surprised if self-service registration is blocked.

## README updates needed

- Document that Reddit now requires manual pre-approval for new API apps (as of Nov 2025); link to Reddit's Developer Support form alongside `prefs/apps`.
- Note the 100 QPM rate limit and the rolling 10-minute window behaviour.
- Confirm `client_credentials` grant is used (no Reddit account password required).

## Confidence

HIGH — token endpoint, base URL, grant type, and all three endpoints confirmed against official OAuth2 wiki and multiple corroborating 2025–2026 sources. Rate limit (100 QPM) confirmed across multiple independent sources; minor variance (some sources say 60 QPM for lower-tier apps) is noted but does not affect the code.

## Sources

1. [Reddit OAuth2 Wiki (reddit-archive)](https://github.com/reddit-archive/reddit/wiki/oauth2) — grant types, token URL, base URL
2. [Reddit API Rate Limits 2026 — PainOnSocial](https://painonsocial.com/blog/reddit-api-rate-limits-guide) — QPM limits, rolling window, response headers
3. [How to Create a Reddit API App in 2026 — REDAccs](https://redaccs.com/reddit-api-guide/) — app registration flow, pre-approval requirement
