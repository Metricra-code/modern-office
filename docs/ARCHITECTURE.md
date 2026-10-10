# Architecture

## Runtime boundaries

```text
Next.js static export (HTML + JS + local fonts + WebP)
  └─ React workspace (client)
       ├─ shared space geometry / Zod protocol
       ├─ useOffice → WebSocket → OfficeRooms
       │    local: Bun server
       │    hosted: Cloudflare Worker → SQLite Durable Object
       └─ useCall → RTCPeerConnection ↔ another browser
                    signaling travels over the WebSocket, media does not
```

- Layout, metadata and the case-study body are build-time Server Components. Only its query-aware return links use a small client component under Suspense. Browser movement, devices and connections live in one client boundary, with no request-time Next server.
- `src/lib/protocol.ts` validates both transport directions; `src/lib/space.ts` owns walkability, room classification and accessible arrival points.
- `server/rooms.ts` owns authoritative identities, membership, non-overlapping arrivals and bounded history independently of socket APIs.
- `server/index.ts` is the native Bun local transport. `server/cloudflare.ts` is the hosted transport; both reuse that domain.
- `src/hooks/use-office.ts` handles handshake deadlines, capped reconnect backoff and validated state. A single pending chat request waits for server ACK; rejected/disconnected/timed-out requests preserve the composer's draft. Changing mode synchronously cancels the old pending request before passive socket cleanup. No automatic replay that might duplicate chat.
- `src/hooks/use-call.ts` owns explicit consent, SDP/ICE ordering, invitation UUIDs, per-call generation guards, timeouts and media cleanup. Hangup bypasses pending SDP work; a new call receives a fresh queue. Late signals must match both guest and invitation, and late asynchronous failures cannot terminate a newer call. Peer departure ends a pending or active call immediately.
- Components receive typed callbacks; no global state framework is needed.

## Guest behavior

**Demo:** explicitly labeled sample peers; messages only in browser component state. No fabricated live presence.

**Live:** a shareable workspace routing key, not a private access credential. The server assigns fresh UUIDs and authoritative message attribution. Channels are public within the workspace. Refresh keeps the workspace URL but establishes a new guest identity; profiles are not persisted locally.

**Calls:** one-to-one. Caller consents by starting; receiver must accept before capture. Unsolicited SDP/ICE from another guest is ignored. Incoming invitations are checked against the latest peer list before opening the consent dialog, including when an invitation and caller departure arrive in the same React batch. This does not change the call-ID protocol or capture devices without acceptance. Media is neither uploaded nor recorded by the app server. STUN-only connectivity can fail across some networks; TURN is an optional deployment concern.

**Movement:** furniture and plants are passable decoration; office boundaries and room walls remain authoritative. Keyboard movement checks these boundaries; click relocates to a legal destination. Floor and avatar click handlers live on sibling surfaces, so WebKit's nearby-descendant touch adjustment cannot redirect a floor click to a person. Room shortcuts scan a bounded set of open spots, avoiding the latest known peer positions. This improves individual avatar selection but is not an authoritative reservation: simultaneous arrivals or deliberate same-point clicks can still overlap; the People list remains available. No pathfinding, proximity calls or booking system.

**Responsive navigation:** the complete map fits the initial viewport, including 320px phones. Zoom changes layout width rather than applying a centered transform, so both edges remain reachable by scrolling. Selecting Team or Office from the mobile drawer also leaves the Conversations tab, making the requested content visible. The space tab is labelled Team or Office to match the content it restores. The drawer makes the underlying workspace inert, contains keyboard focus, and releases it on close or a desktop resize.

**Dialog focus:** native modal focus trapping and return remain authoritative. Before opening, the dialog remembers the invoker's nearest focusable context. If closing leaves focus on the body or inside the closed dialog because a guest's trigger disappeared, it tries that context (map or People panel), then a focusable ancestor if the context is hidden. It does not override a successful native return, including to an input in an underlying profile dialog.

At widths up to 760px, navigation, message send, dialog close and map zoom have real 44×44px button boxes, not overlapping pseudo-element hit areas. The map footer wraps when needed; desktop controls retain their compact sizes. This is a targeted usability improvement, not a claim that every control meets WCAG AAA.

**Device controls:** Focus has one stable accessible name and a pressed state reflecting the guest status. Call microphone and camera buttons instead name the next action (Mute/Unmute, Turn camera off/on), without a contradictory pressed state. The separate Test camera action still opens a consent-based device preview; no media capture or signaling boundary changed.

**Profile recovery:** an unsent live profile update leaves the native dialog open, preserves name/color drafts and shows its error inside the modal rather than only behind the backdrop. It does not change the displayed profile. After reconnecting, the same open dialog can retry; profiles remain ephemeral guest state, not durable storage.

Valid 24-character unbroken names wrap in the profile preview, sidebar, Team directory, message author and dialog heading instead of pushing adjacent controls out of view. Map labels still use the first word, but only that word is ellipsized when long, so it cannot inflate the person's invisible button area. You/focusing markers stay outside the clipped text; the full button accessible name and profile value remain unchanged.

**Conversation reading:** new messages follow only near the bottom; reading history exposes an explicit jump instead of scrolling the reader away. Other channels and the People panel do not trigger chat scrolling. Mobile visibility changes preserve reading position. Tabs have one tab stop, wrapped arrow navigation, Home/End and a labeled focusable panel. At most ten in-memory mode/channel drafts are kept; an ACK clears only its submitted draft revision, not later edits or another channel. Drafts are not persisted across page navigation or reload.

**Navigation context:** engineering notes and the brand link carry only a validated workspace routing key and exact demo/live mode through fixed internal paths. Returning can establish a fresh guest identity in the same workspace; it does not preserve calls or profiles. Before hydration, case-study return links are non-interactive rather than pointing to the wrong room. The prerendered workspace is natively inert and marked busy until its URL context initializes; this does not wait for the realtime network to connect. The existing connection pill shows Preparing during this preview, with a status outside the inert subtree for assistive technology. Link prefetch is disabled until context initializes, then returns to Next's default behavior.

**Render boundary:** the bounded message list receives only immutable messages and the current sender ID. Filtering and the list are memoized, so avatar movement does not repeatedly format unchanged messages. People, call controls and presence remain live; no virtualized list or additional state library is introduced.

## Hosted hibernation

One Durable Object coordinator limits the whole portfolio to 256 guests and 64 workspaces. `acceptWebSocket` keeps connections alive while the isolate hibernates. Validated socket attachments restore identity, position, presence, cooldown and rate-limit windows.

Each occupied workspace has at most one SQLite row containing the latest 100 messages. Chat updates that row before ACK; a failed write rolls the domain back. Movement only changes socket attachments. Restoring the object reconstructs `OfficeRooms` from active sockets and bounded SQL history. Empty workspace rows are removed after the last guest leaves, including stale rows found on restoration. This is temporary application session state, not product history. Cloudflare SQLite PITR can retain recovery data for 30 days; deletion from the app is not immediate physical erasure from platform backups.

## Security / ceilings

- Hosted upgrade checks exact same origin; optional additional origins are an explicit allowlist. Bun production requires `ALLOWED_ORIGINS`.
- Strict input schemas reject spoofed sender fields, non-finite coordinates and unsafe destinations. React renders user content as escaped text.
- 32 guests/workspace; 256 total; 64 workspaces; 100 messages/workspace; 20KB messages; 40 events/sec/socket; 350ms chat cooldown.
- Signaling targets must belong to the same workspace. Request IDs and call IDs correlate delivery/invitations only; they never confer identity or authority.
- No auth, permanent profile storage, analytics, recording or app content logs. Query parameters include a guest display name; do not add request-URL logging without redaction.
- Free cloud quotas can make the service unavailable. Exact Origin checking is not authorization, and per-socket quotas do not defeat distributed abuse.

## Deliberate omissions

Authenticated teams, expiring invites, durable chat archives, reliable TURN on all networks, group-call SFU, distributed scaling and click-to-walk pathfinding are outside the guest portfolio scope. Add them only for actual product requirements, not as speculative architecture.

## Migration

| Original                   | Rebuild                                                    |
| -------------------------- | ---------------------------------------------------------- |
| Vue + Vite                 | Next App Router + React static shell                       |
| Pinia socket/peer stores   | Focused transport and call lifecycle hooks                 |
| Hardcoded remote signaling | Local Bun + same-origin hosted Worker                      |
| Pixel canvas               | Local AI-assisted floorplan + accessible DOM controls      |
| PeerJS and direct messages | Native WebRTC + public workspace/room chat                 |
| Global key handling        | Movement only while map is focused                         |
| No documented tests        | Bun domain/hibernation tests + Playwright/a11y regressions |

The original sibling `modern-office-main` and unrelated company repository remain untouched.
