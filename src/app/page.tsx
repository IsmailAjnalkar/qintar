import Link from "next/link";

import { WaitlistForm } from "@/components/waitlist-form";

export default function HomePage() {
  return (
    <>
      {/* NAV */}
      <header className="q-nav">
        <div className="q-container q-nav__inner">
          <Link className="q-nav__brand" href="/" aria-label="qintar">
            qintar<span className="q-dot" aria-hidden="true" />
          </Link>
          <nav className="q-nav__links" aria-label="Primary">
            <Link href="#how">How it works</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="#faq">FAQ</Link>
          </nav>
          <Link className="q-btn q-btn--primary q-btn--sm" href="#waitlist">
            Join waitlist
          </Link>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="q-hero">
          <div className="q-hero__bg" aria-hidden="true" />
          <div className="q-container q-hero__layout">
            <div>
              <span className="q-eyebrow">AI Pipeline Coach · for HubSpot</span>
              <h1 className="q-h1">
                Stop running pipeline reviews. Start reading them at <em>9:01am</em>.
              </h1>
              <p className="q-lede">
                Qintar reads your HubSpot pipeline every night and sends each rep their three deals
                to push, stalled deals to revive, and at-risk customers to call. With one-click
                email drafts.
              </p>
              <div className="q-hero__cta" id="waitlist">
                <WaitlistForm source="hero" ctaLabel="Join the waitlist" />
              </div>
              <p className="q-hero__caption">
                For sales teams of 3–25 reps on HubSpot. We email when your invite is ready.
              </p>
              <div className="q-hero__signals" aria-label="Trust signals">
                <span className="q-hero__signal">HubSpot-native</span>
                <span className="q-hero__signal">Slack delivery</span>
                <span className="q-hero__signal">Connect in 90 seconds</span>
              </div>
            </div>

            {/* Product preview: Slack digest card */}
            <div id="digest-preview" className="q-preview" aria-label="Sample Slack digest from Qintar">
              <div className="q-preview__chrome" aria-hidden="true">
                <span /><span /><span />
                <span className="t">#sales-pipeline · 8:30 AM</span>
              </div>
              <div className="q-slack-msg">
                <div className="q-slack-avatar">Q</div>
                <div className="q-slack-body">
                  <div className="q-slack-meta">
                    <span className="q-slack-name">Qintar</span>
                    <span className="q-slack-time">8:30 AM</span>
                  </div>
                  <p className="q-digest-title">
                    Morning Maya. 3 deals to push, 1 stalled, 1 at-risk. 60 seconds 👇
                  </p>

                  <div className="q-digest-item">
                    <span className="q-digest-item__pill pill-urgent">Push today</span>
                    <div>
                      <div className="q-digest-text">
                        <strong>Acme Co. · $48,000</strong> — proposal sent 3 days ago, no reply.
                        Champion opened it twice yesterday.
                      </div>
                      <div className="q-digest-actions">
                        <button type="button" className="q-digest-action q-digest-action--primary">
                          Draft follow-up
                        </button>
                        <button type="button" className="q-digest-action">
                          Snooze 1 day
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="q-digest-item">
                    <span className="q-digest-item__pill pill-stalled">Stalled</span>
                    <div>
                      <div className="q-digest-text">
                        <strong>Brightline · $22,500</strong> — stage unchanged 14 days. Last touch
                        was a Q2 demo.
                      </div>
                    </div>
                  </div>

                  <div className="q-digest-item">
                    <span className="q-digest-item__pill pill-risk">At risk</span>
                    <div>
                      <div className="q-digest-text">
                        <strong>Northwind</strong> (customer) — usage down 60% MoM. Renewal in 41
                        days.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="q-section q-section--subtle" id="problem">
          <div className="q-container">
            <div className="q-problem-header">
              <span className="q-eyebrow">The problem</span>
              <h2 className="q-h2" style={{ marginTop: "var(--q-space-3)" }}>
                Your pipeline review takes an hour. Your real signal takes thirty seconds.
              </h2>
              <p className="q-lede" style={{ marginTop: "var(--q-space-4)" }}>
                Reps spend 5+ hours a week in CRM hygiene. Managers run pipeline reviews that
                surface the obvious deals and miss the ones quietly slipping.
              </p>
            </div>
            <div className="q-problem-grid">
              <article className="q-problem-card">
                <div className="q-problem-card__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                </div>
                <h3 className="q-h3">Pipeline reviews are slow.</h3>
                <p>Mondays disappear into HubSpot filter views and color-coded spreadsheets. Reps tune out by minute 15.</p>
              </article>
              <article className="q-problem-card">
                <div className="q-problem-card__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h18M12 3v18" />
                  </svg>
                </div>
                <h3 className="q-h3">Signals are buried.</h3>
                <p>A deal slipped 14 days. A customer&rsquo;s usage halved. Your CRM knows. Nothing surfaces it until the QBR.</p>
              </article>
              <article className="q-problem-card">
                <div className="q-problem-card__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12l4 4L20 6" />
                  </svg>
                </div>
                <h3 className="q-h3">Next action is fuzzy.</h3>
                <p>You know the deal is stuck. You don&rsquo;t know exactly what to send. Drafting a real follow-up takes 20 minutes.</p>
              </article>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="q-section" id="how">
          <div className="q-container">
            <div className="q-problem-header">
              <span className="q-eyebrow">How it works</span>
              <h2 className="q-h2" style={{ marginTop: "var(--q-space-3)" }}>
                Connect HubSpot once. Get your first digest tomorrow morning.
              </h2>
            </div>
            <div className="q-how-grid">
              <article className="q-step">
                <div className="q-step__num">Step 01</div>
                <div className="q-step__illustration illo-connect" aria-hidden="true">
                  <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="20" width="32" height="48" rx="6" stroke="#4A547A" strokeWidth="2" />
                    <rect x="50" y="20" width="32" height="48" rx="6" stroke="#4A547A" strokeWidth="2" />
                    <path d="M38 44H50" stroke="#3B40E0" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="38" cy="44" r="3" fill="#3B40E0" />
                    <circle cx="50" cy="44" r="3" fill="#3B40E0" />
                    <rect x="20" y="34" width="4" height="4" fill="#3B40E0" />
                    <rect x="64" y="34" width="4" height="4" fill="#3B40E0" />
                  </svg>
                </div>
                <h3 className="q-h3">Connect HubSpot &amp; Slack</h3>
                <p>Two OAuth clicks. We pull deals, contacts, and activity every 15 minutes. No reps to invite, no CSV imports.</p>
              </article>
              <article className="q-step">
                <div className="q-step__num">Step 02</div>
                <div className="q-step__illustration illo-score" aria-hidden="true">
                  <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="44" cy="44" r="28" stroke="#E2E5EE" strokeWidth="6" />
                    <path d="M44 16a28 28 0 0 1 24.25 41.99" stroke="#3B40E0" strokeWidth="6" strokeLinecap="round" />
                    <text x="44" y="50" textAnchor="middle" fontFamily="Geist, Inter, sans-serif" fontWeight="600" fontSize="18" fill="#111634">78</text>
                    <rect x="42" y="6" width="4" height="4" fill="#3B40E0" />
                  </svg>
                </div>
                <h3 className="q-h3">We score and prioritize</h3>
                <p>Pipeline Health Score reads stage, age, last touch, customer usage, and a half-dozen other signals. Top three actions surface; everything else stays out of your way.</p>
              </article>
              <article className="q-step">
                <div className="q-step__num">Step 03</div>
                <div className="q-step__illustration illo-act" aria-hidden="true">
                  <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="12" y="22" width="64" height="36" rx="6" stroke="#4A547A" strokeWidth="2" />
                    <path d="M12 30h64" stroke="#4A547A" strokeWidth="2" />
                    <rect x="20" y="38" width="36" height="3" rx="1.5" fill="#A4ABC2" />
                    <rect x="20" y="46" width="28" height="3" rx="1.5" fill="#A4ABC2" />
                    <rect x="48" y="62" width="28" height="14" rx="4" fill="#3B40E0" />
                    <path d="M58 69h8M64 66l3 3-3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="q-h3">Send the email in one click</h3>
                <p>Each digest item links to a draft tailored to that deal — stage, contact history, notes baked in. Edit and send via Gmail or Outlook. Done in 90 seconds.</p>
              </article>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="q-proof" aria-label="Used by sales teams">
          <div className="q-container">
            <p>Beta partners — logos applied at GA</p>
            <div className="q-proof__logos">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="q-proof__logo" aria-label="Beta partner logo placeholder" />
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="q-section q-section--subtle" id="pricing">
          <div className="q-container">
            <div className="q-problem-header">
              <span className="q-eyebrow">Pricing</span>
              <h2 className="q-h2" style={{ marginTop: "var(--q-space-3)" }}>
                Simple plans. Cancel anytime.
              </h2>
              <p className="q-lede" style={{ marginTop: "var(--q-space-4)" }}>
                14-day free trial on Team. No card required.
              </p>
            </div>
            <div className="q-pricing-grid">
              <article className="q-plan">
                <h3>Starter</h3>
                <p className="q-plan__sub">Solo founders and individual AEs.</p>
                <div className="q-plan__price">
                  <span className="q-plan__amount">$49</span>
                  <span className="q-plan__per">per month</span>
                </div>
                <Link href="#waitlist" className="q-btn q-btn--secondary q-btn--md q-btn--full q-plan__cta">
                  Join waitlist
                </Link>
                <ul className="q-plan__features">
                  <li>1 seat</li>
                  <li>Up to 50 active deals</li>
                  <li>Daily Slack digest</li>
                  <li>AI-drafted email actions</li>
                </ul>
              </article>

              <article className="q-plan q-plan--featured">
                <h3>Team</h3>
                <p className="q-plan__sub">Sales teams of 5–10 reps. Where most teams land.</p>
                <div className="q-plan__price">
                  <span className="q-plan__amount">$499</span>
                  <span className="q-plan__per">per month</span>
                </div>
                <Link href="#waitlist" className="q-btn q-btn--primary q-btn--md q-btn--full q-plan__cta">
                  Start free trial
                </Link>
                <ul className="q-plan__features">
                  <li>Up to 10 seats</li>
                  <li>Unlimited deals</li>
                  <li>Team Slack digest + per-rep digests</li>
                  <li>AI-drafted email actions (Gmail / Outlook)</li>
                  <li>Pipeline Health Score</li>
                  <li>Weekly recap email</li>
                </ul>
              </article>

              <article className="q-plan">
                <h3>Scale</h3>
                <p className="q-plan__sub">25–50 rep orgs with multi-pipeline complexity.</p>
                <div className="q-plan__price">
                  <span className="q-plan__amount">$1,499</span>
                  <span className="q-plan__per">per month</span>
                </div>
                <Link href="#waitlist" className="q-btn q-btn--secondary q-btn--md q-btn--full q-plan__cta">
                  Talk to sales
                </Link>
                <ul className="q-plan__features">
                  <li>Up to 50 seats</li>
                  <li>Everything in Team</li>
                  <li>SSO &amp; SCIM</li>
                  <li>Multi-pipeline support</li>
                  <li>Custom workflows</li>
                  <li>Priority support</li>
                </ul>
              </article>
            </div>
            <p className="q-pricing-footnote">Annual plans are 2 months free. Pricing in USD.</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="q-section" id="faq">
          <div className="q-container">
            <div className="q-problem-header">
              <span className="q-eyebrow">Questions</span>
              <h2 className="q-h2" style={{ marginTop: "var(--q-space-3)" }}>
                Things people ask before signing up.
              </h2>
            </div>
            <div className="q-faq">
              <details>
                <summary>Does Qintar write inside HubSpot?</summary>
                <p>Read-only on day one. We pull deals, contacts, companies, and activity. Writes — logging a sent email back as a HubSpot activity — ship in v0.2 as an opt-in.</p>
              </details>
              <details>
                <summary>What CRMs do you support?</summary>
                <p>HubSpot. Pipedrive is next. Salesforce is on the roadmap, but not this quarter.</p>
              </details>
              <details>
                <summary>How does the AI know what to write?</summary>
                <p>Each draft uses the deal&rsquo;s stage, the contact&rsquo;s last 90 days of activity, notes, and replies. If you upload your team&rsquo;s voice guidelines, those are in the prompt too. We use Claude for drafts.</p>
              </details>
              <details>
                <summary>Where is my CRM data stored?</summary>
                <p>Encrypted at rest in our US-region database. We don&rsquo;t train on your data and we don&rsquo;t sell it. Full security details at <Link href="/security">qintar.com/security</Link>.</p>
              </details>
              <details>
                <summary>Can I cancel anytime?</summary>
                <p>Yes. Self-serve in settings. Your last paid month runs to its end date — no penalty, no retention calls.</p>
              </details>
            </div>
          </div>
        </section>

        {/* FINAL CTA BAND */}
        <section className="q-section q-cta-band">
          <div className="q-container">
            <span className="q-eyebrow" style={{ display: "block", textAlign: "center", color: "var(--q-indigo-300)" }}>
              Get on the list
            </span>
            <h2 className="q-h2" style={{ marginTop: "var(--q-space-3)" }}>
              Private beta opens in W5. First 50 teams pay nothing for 3 months.
            </h2>
            <WaitlistForm source="footer-cta" variant="inverse" ctaLabel="Join waitlist" />
            <p className="q-cta-band__caption">We email when your invite is ready. Nothing else.</p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="q-footer">
        <div className="q-container">
          <div className="q-footer__grid">
            <div className="q-footer__about">
              <Link className="q-nav__brand" href="/" aria-label="qintar" style={{ color: "white" }}>
                qintar<span className="q-dot" style={{ background: "var(--q-indigo-400)" }} />
              </Link>
              <p>The AI Pipeline Coach for B2B sales teams on HubSpot.</p>
            </div>
            <div className="q-footer__col">
              <h4>Product</h4>
              <ul>
                <li><Link href="#how">How it works</Link></li>
                <li><Link href="#pricing">Pricing</Link></li>
                <li><Link href="/changelog">Changelog</Link></li>
                <li><Link href="/security">Security</Link></li>
              </ul>
            </div>
            <div className="q-footer__col">
              <h4>Company</h4>
              <ul>
                <li><Link href="/about">About</Link></li>
                <li><Link href="/blog">Blog</Link></li>
                <li><Link href="/careers">Careers</Link></li>
                <li><Link href="mailto:hello@qintar.com">Contact</Link></li>
              </ul>
            </div>
            <div className="q-footer__col">
              <h4>Resources</h4>
              <ul>
                <li><Link href="/docs">Docs</Link></li>
                <li><Link href="/security">Security</Link></li>
                <li><Link href="/status">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="q-footer__legal">
            <span>© {new Date().getFullYear()} Qintar, Inc.</span>
            <nav aria-label="Legal">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/dpa">DPA</Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
