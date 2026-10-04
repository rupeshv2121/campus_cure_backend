# CC-70: Installable app and offline reading

| | |
|---|---|
| **Status** | **Implemented** 2026-10-04. Build verified; install and offline need a check on a real device |
| **Phase** | 7 |
| **Branch** | `feat/CC-70-pwa` |
| **Repos** | frontend |
| **Depends on** | CC-41 (shares its service worker) |
| **Blocks** | nothing |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

CampusCure is a website. It cannot sit on a phone's home screen, and with no signal (a basement
lab, a lecture hall) it shows nothing at all, even a doubt the student read five minutes ago.

## Goal

The app can be installed, opens with no network, and shows recently viewed doubts and complaints
while offline, clearly marked as offline.

## Non-goals

- **Writing offline.** Queueing a doubt or complaint for later sync was cut in the roadmap:
  conflict resolution and background sync are a semester of work for a problem campus Wi-Fi mostly
  doesn't have.
- Caching attachments. Their signed URLs expire in minutes.

## Design

`vite-plugin-pwa` in **injectManifest** mode. The plugin generates the manifest and the list of built
files; the service worker itself is ours, `src/sw.ts`, because it also carries CC-41's push
handlers.

| Piece | Behaviour |
|---|---|
| App shell | Every built file is precached (83 files, 4.5 MB). The face-api models and their 640 KB library are excluded: only the face screens use them |
| Navigation | Any deep link offline gets `index.html` and routes client-side |
| API reads | **Network first**, 5 s timeout, falling back to cache. Nobody is shown stale data while online |
| Updates | `skipWaiting` + `clients.claim`; Vercel serves `sw.js` with `no-cache` so a deploy reaches users on their next load |

**What may be cached offline** (`src/lib/offlineCache.ts`) is a privacy boundary, so it is an
explicit allow-list: the doubt list, a single doubt, tags and bookmarks; the signed-in student's
complaints; and the faculty doubt queue. Never auth, profile, 2FA, admin, statistics, data-export,
notification or attachment URLs, and never the computed doubt endpoints.

**The cache is cleared on logout.** It is keyed by URL, not by user, so without this the next person
on a shared computer would be shown the previous person's complaints while offline. The same module
defines what is cached and clears it, so the two cannot drift.

The layout shows an "offline" banner, so cached data is never mistaken for live data and a failed
save has an explanation. Icons (192, 512, maskable 512, Apple 180) were generated from
`public/logo.jpeg`.

## Acceptance criteria

1. Chrome and Edge offer "Install"; the installed app opens standalone with the CampusCure icon.
2. With the network off, the app opens and previously viewed doubts and complaints display.
3. An offline banner shows while there is no connection.
4. After logout, nothing from the previous user is readable offline.
5. Nothing on the deny-list is ever stored.

## Testing

- `offlineCache.test.ts`: the allow-list in both directions, including every sensitive path (5).
- The service worker type-checks on its own (`npx tsc -p tsconfig.sw.json`, WebWorker lib).
- The production build generates `sw.js` and `manifest.webmanifest` and links the manifest.
- **Still to check by hand:** 1-4 in a real browser. Chrome DevTools → Application → Service
  Workers / Manifest, then Network → Offline.
