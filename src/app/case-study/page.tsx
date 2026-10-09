import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight, Check, Circle, GitBranch, Radio } from 'lucide-react';
import { OfficeReturnLink } from '@/components/office-return-link';
export const metadata: Metadata = { title: 'Behind the build' };
export default function CaseStudyPage() {
  return (
    <main className="case-study">
      <nav className="case-nav">
        <OfficeReturnLink className="case-back">
          <ArrowLeft size={16} />
          Back to the office
        </OfficeReturnLink>
        <span>MODERN OFFICE / ENGINEERING NOTES</span>
      </nav>
      <header className="case-header">
        <p className="eyebrow">ENGINEERING NOTES</p>
        <h1>
          A spatial workspace.
          <br />
          From Vue to Next.js<span className="heading-period">.</span>
        </h1>
        <p>
          A guest workspace with shared avatar movement, chat and one-to-one calls. No account is
          needed to try the product.
        </p>
        <div className="case-stack">
          <span>Next.js App Router</span>
          <span>TypeScript</span>
          <span>Bun</span>
          <span>WebSocket</span>
          <span>WebRTC</span>
        </div>
      </header>
      <section className="case-section">
        <div className="case-section-label">
          <span>01 / THE IDEA</span>
          <h2>
            Start inside the product.
            <br />
            No signup step.
          </h2>
        </div>
        <div className="case-body">
          <p>
            The original Vue prototype explored avatar movement, group chat and peer-to-peer calls.
            This rebuild preserves that premise, while rethinking the experience around a simple
            journey: enter a space, find a teammate, start a conversation.
          </p>
          <p>
            The hosted version opens in a live guest workspace. Share its link or open a second
            guest to test synchronization. Offline demo mode is separate and clearly labels sample
            people and messages.
          </p>
          <p>
            Four rooms create a visual vocabulary: collaborative studio, meeting room, quiet focus
            nook and informal lounge. Keyboard movement and room shortcuts make the experience
            usable without precision pointing.
          </p>
        </div>
      </section>
      <section className="case-section">
        <div className="case-section-label">
          <span>02 / THE SYSTEM</span>
          <h2>
            Small pieces.
            <br />
            Clear boundaries.
          </h2>
        </div>
        <div className="case-body">
          <div
            className="architecture-diagram"
            aria-label="Architecture: static Next.js shell hosts React client; WebSocket transports presence, chat and call signaling to Cloudflare Durable Object or local Bun server; WebRTC sends media directly between browsers"
          >
            <div>
              <span>STATIC AT BUILD TIME</span>
              <strong>Next.js shell</strong>
              <small>Metadata · local fonts · case study</small>
            </div>
            <div className="architecture-arrow">↓ hydration</div>
            <div>
              <span>INTERACTIVE AT RUNTIME</span>
              <strong>React workspace</strong>
              <small>Space geometry · office hook · call hook</small>
            </div>
            <div className="architecture-branches">
              <div>
                <Radio size={19} />
                <strong>Cloudflare WebSocket</strong>
                <small>Hibernatable guest state; Bun for local development</small>
              </div>
              <div>
                <GitBranch size={19} />
                <strong>Browser ↔ Browser</strong>
                <small>Explicit-consent WebRTC media; no recording</small>
              </div>
            </div>
          </div>
          <p>
            Shared Zod schemas validate both directions of the transport boundary. The server, not
            the browser, assigns sender IDs and message attribution. Workspaces isolate presence and
            signaling; message history is bounded and discarded after the last guest leaves.
          </p>
          <p>
            Pure spatial geometry is shared by the browser and server. React components own
            presentation; hooks own connection and media lifecycles. No global state library is
            needed for this scope.
          </p>
        </div>
      </section>
      <section className="case-section">
        <div className="case-section-label">
          <span>03 / THE DECISIONS</span>
          <h2>
            Tools chosen for
            <br />
            the actual scope.
          </h2>
        </div>
        <div className="case-body">
          <dl className="decision-list">
            <div>
              <dt>Why Next.js?</dt>
              <dd>
                File-based routes, metadata and a statically exported shell make the project easy to
                present and host. The office is honestly client-heavy; this is not a claim that
                Server Components accelerate a realtime game.
              </dd>
            </div>
            <div>
              <dt>Why Bun?</dt>
              <dd>
                One tool for installation, unit tests and the persistent realtime server. Native
                WebSocket support removes the need for Express, ws and PeerJS signaling services.
              </dd>
            </div>
            <div>
              <dt>Why guest sessions?</dt>
              <dd>
                Guest sessions avoid signup and permanent profiles. Hosted chat temporarily uses
                SQLite inside a Durable Object to survive hibernation; the last guest leaving
                deletes its history. A guest link is not private-team authentication.
              </dd>
            </div>
            <div>
              <dt>Why local assets and CSS?</dt>
              <dd>
                A small token system and a locally stored, AI-assisted 2D pixel-art office map
                deliver a recognizable visual identity without an image service, a game engine or a
                heavyweight UI kit.
              </dd>
            </div>
            <div>
              <dt>Why direct WebRTC?</dt>
              <dd>
                One-to-one media stays between consenting browsers. The server relays signaling
                only. STUN helps discover connectivity; difficult networks may require a self-hosted
                TURN relay.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="case-section">
        <div className="case-section-label">
          <span>04 / QUALITY & HONEST LIMITS</span>
          <h2>
            A demo you can try.
            <br />
            Decisions you can discuss.
          </h2>
        </div>
        <div className="case-body">
          <ul className="quality-list">
            <li>
              <Check size={16} />
              Unit tests for movement, schemas, room isolation and cleanup.
            </li>
            <li>
              <Check size={16} />
              Browser tests for profiles, chat, keyboard navigation and multiple guests.
            </li>
            <li>
              <Check size={16} />
              Permission-denied paths, reconnect backoff, timeouts and media track cleanup.
            </li>
            <li>
              <Check size={16} />
              Semantic controls, native dialogs, focus states and reduced-motion support.
            </li>
            <li>
              <Check size={16} />
              Local fonts, no trackers, bounded temporary chat storage and server-confirmed
              delivery.
            </li>
          </ul>
          <div className="case-limits">
            <h3>Deliberate boundaries</h3>
            <ul>
              <li>
                <Circle size={10} />
                Guest workspaces are not authenticated or private. Anyone with a link can join.
              </li>
              <li>
                <Circle size={10} />
                One Durable Object coordinator bounds this portfolio at 256 connected guests and 64
                workspaces. It is not an unlimited distributed service.
              </li>
              <li>
                <Circle size={10} />
                Clicking relocates to a valid destination; it is not obstacle-aware pathfinding.
              </li>
              <li>
                <Circle size={10} />
                Room counts are guidance, not enforced reservations. Calls are one-to-one, not
                conferences.
              </li>
              <li>
                <Circle size={10} />
                Cloudflare serves both static assets and live WebSockets. Free account quotas apply;
                STUN-only calls can fail on restrictive networks without a TURN relay.
              </li>
            </ul>
          </div>
        </div>
      </section>
      <footer className="case-footer">
        <div>
          <p className="eyebrow">TRY THE IMPLEMENTATION</p>
          <h2>Open the workspace.</h2>
        </div>
        <OfficeReturnLink className="primary-button">
          Explore the office <ArrowUpRight size={17} />
        </OfficeReturnLink>
      </footer>
    </main>
  );
}
