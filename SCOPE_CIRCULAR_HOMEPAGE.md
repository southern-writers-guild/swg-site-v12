# Scope checklist — Circular on the homepage, Right Now rework

Created 2026-10-13, before any building begins (CLAUDE.md scope-document rule). Covers what Rick and the partners agreed on 2026-10-13:

- The SWG Circular gets a permanent section on the homepage, between the hero and Right Now. The newest issue is shown large and the previous issue at about half size. Older issues go to a Circular Archive page. All of this updates itself.
- A Circular is published as an ordinary Porch Story with a new "This is an SWG Circular" checkbox ticked. Kit is not involved.
- Right Now shows three posts. The three newest switched-on posts win. If fewer than three are switched on, the newest other posts fill the gaps. Circulars never appear in Right Now, even if switched on.
- Circulars keep appearing in the regular Porch lists, unchanged (Rick, 2026-10-13).

**Status values:** untested · tested-working · tested-broken · not-applicable

| # | Surface | What changes | Status | Notes |
|---|---|---|---|---|
| 1 | Studio — Porch Story form | New `isCircular` checkbox; `showOnHomepage` help text rewritten | untested | Written 2026-10-13, schema file loads cleanly; not yet deployed. |
| 2 | Studio — Guild Video form | `showOnHomepage` help text rewritten to match | untested | `schemaTypes/guild-video.js` |
| 3 | Existing Circular document ("The SWG Circular", id dbe3b05f…) | `isCircular` set to true | untested | Until this is set, the Circular section is empty and the existing Circular appears nowhere on the homepage (Right Now no longer shows it either — row 5) |
| 4 | Homepage — Circular section (new) | Newest Circular large, previous one half size, link to archive | untested | Layout checked 2026-10-13 by mocking it onto the live page with the real Circular: desktop (cover left, text right; previous issue at half width) and phone (stacks, no sideways scroll). Real code not yet live. |
| 5 | Homepage — Right Now | 3 posts, picks first then fill, Circulars excluded, 3 across | untested | Query logic run against live data 2026-10-13: before the Circular is ticked → Tailgate, Fine Print, Circular (same as today); with the Circular excluded → Tailgate, Fine Print, Buffalo Jump. Missing `isCircular` correctly counts as not-a-Circular. |
| 6 | Circular Archive page (new) `/the-porch/circular/` | Lists every Circular, newest first | untested | Builds cleanly (full `npm run build` in a scratch copy, 2026-10-13). |
| 7 | Porch main page `/the-porch/` | No change — Circulars still listed | not-applicable | Rick's call 2026-10-13 |
| 8 | Porch archive `/the-porch/archive/` | No change | not-applicable | |
| 9 | Individual story page (the Circular's own page) | No change | not-applicable | Circular links go to `/the-porch/<slug>/` as now |
| 10 | The Work — Kitchen Table (essays) | No change | not-applicable | Uses `essayFeatured`, unrelated |
| 11 | Homepage click-to-edit / preview | No change to hero preview; new sections read published content only, same as Right Now did | untested | Confirm the hero preview path still works after the edit |
| 12 | Vercel function count (11 of 12) | No new function | not-applicable | Everything here reads Sanity's public feed directly |
| 13 | Phone layout | Circular section stacks; Right Now stacks | untested | |
