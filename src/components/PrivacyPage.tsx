export default function PrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <button
        onClick={onBack}
        className="mb-8 text-sm text-link hover:underline font-medium"
      >
        ← Back
      </button>

      <h1 className="font-display text-3xl font-medium text-ink tracking-display mb-2">
        Privacy & Data Safety
      </h1>
      <p className="text-sm text-steel mb-10">
        Last updated: August 2026
      </p>

      <div className="space-y-8">
        {/* TL;DR */}
        <section className="rounded-lg bg-cream border border-beige-deep p-6">
          <h2 className="text-lg font-medium text-ink mb-3">The short version</h2>
          <ul className="space-y-2 text-sm text-charcoal">
            <li className="flex gap-2">
              <span className="text-primary shrink-0">✓</span>
              All your data stays in your browser. Nothing leaves your machine.
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">✓</span>
              No server, no database, no analytics, no tracking.
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">✓</span>
              No one else can see your attendance data — not even the developer.
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">✓</span>
              You can delete all data at any time from your browser settings.
            </li>
          </ul>
        </section>

        {/* Where data is stored */}
        <section>
          <h2 className="text-lg font-medium text-ink mb-3">Where is my data stored?</h2>
          <p className="text-sm text-charcoal leading-relaxed mb-3">
            Everything is stored in your browser's <strong>localStorage</strong> — the same mechanism websites use to remember your preferences. It lives on your computer, tied to this specific browser and URL.
          </p>
          <div className="rounded-lg border border-hairline bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-2">Stored items</p>
            <ul className="space-y-1.5 text-xs text-charcoal">
              <li><span className="font-mono text-steel">attendance-insights-data</span> — Your attendance records by month</li>
              <li><span className="font-mono text-steel">attendance-insights-user</span> — Your name (for the header)</li>
              <li><span className="font-mono text-steel">attendance-insights-profile</span> — Employee info (designation, department)</li>
              <li><span className="font-mono text-steel">attendance-empId</span> — Your HROne employee ID</li>
              <li><span className="font-mono text-steel">attendance-last-synced</span> — When data was last refreshed</li>
              <li><span className="font-mono text-steel">theme</span> — Light or dark preference</li>
            </ul>
          </div>
        </section>

        {/* Network activity */}
        <section>
          <h2 className="text-lg font-medium text-ink mb-3">Does this app make network requests?</h2>
          <p className="text-sm text-charcoal leading-relaxed mb-3">
            The app itself makes <strong>zero network requests</strong>. It's a static HTML/CSS/JS file served from your network. Once loaded, it works entirely offline.
          </p>
          <p className="text-sm text-charcoal leading-relaxed">
            The <strong>bookmarklet</strong> and <strong>Chrome extension</strong> make requests to <code className="text-xs font-mono bg-surface px-1 py-0.5 rounded">app.hrone.cloud</code> — the same HROne portal you're already logged into. They only talk to HROne and to this app. They never contact any third-party server.
          </p>
        </section>

        {/* Extension permissions */}
        <section>
          <h2 className="text-lg font-medium text-ink mb-3">What does the extension access?</h2>
          <div className="rounded-lg border border-hairline bg-surface p-4">
            <ul className="space-y-3 text-sm text-charcoal">
              <li>
                <p className="font-medium text-ink">app.hrone.cloud</p>
                <p className="text-xs text-steel">Reads attendance API responses when you visit the calendar page. Also fetches your profile and today's punch data.</p>
              </li>
              <li>
                <p className="font-medium text-ink">Your app tab (localhost or internal IP)</p>
                <p className="text-xs text-steel">Sends the captured data to this dashboard so it can display your attendance.</p>
              </li>
              <li>
                <p className="font-medium text-ink">chrome.storage.local</p>
                <p className="text-xs text-steel">Temporarily holds data between tabs. Cleared when you uninstall the extension.</p>
              </li>
            </ul>
          </div>
          <p className="text-sm text-charcoal mt-3 leading-relaxed">
            The extension does <strong>not</strong> access your passwords, browsing history, other tabs, files, or any website other than HROne and this app.
          </p>
        </section>

        {/* What the developer can see */}
        <section>
          <h2 className="text-lg font-medium text-ink mb-3">Can the developer see my data?</h2>
          <p className="text-sm text-charcoal leading-relaxed">
            <strong>No.</strong> There is no server collecting data. No telemetry, no error reporting, no usage analytics. The developer has no way to access your localStorage or see what you're doing in the app. This is verifiable — the full source code is available and the app works offline.
          </p>
        </section>

        {/* Credentials */}
        <section>
          <h2 className="text-lg font-medium text-ink mb-3">Are my HROne credentials exposed?</h2>
          <p className="text-sm text-charcoal leading-relaxed mb-3">
            <strong>No.</strong> The bookmarklet and extension use your existing HROne browser session (the cookie your browser already has from logging in). They never ask for, store, or transmit your username or password.
          </p>
          <p className="text-sm text-charcoal leading-relaxed">
            If your HROne session expires, the sync will fail with an error. You'll need to log back into HROne normally — this app cannot and does not handle authentication.
          </p>
        </section>

        {/* How to delete */}
        <section>
          <h2 className="text-lg font-medium text-ink mb-3">How do I delete my data?</h2>
          <div className="rounded-lg border border-hairline bg-surface p-4 space-y-3">
            <div>
              <p className="font-medium text-ink text-sm">Option 1: Clear this site's data</p>
              <p className="text-xs text-steel">Chrome → DevTools (F12) → Application tab → Storage → Clear site data</p>
            </div>
            <div>
              <p className="font-medium text-ink text-sm">Option 2: Clear localStorage</p>
              <p className="text-xs text-steel">Chrome → DevTools → Console → type: <code className="font-mono bg-canvas px-1 rounded">localStorage.clear()</code></p>
            </div>
            <div>
              <p className="font-medium text-ink text-sm">Option 3: Uninstall the extension</p>
              <p className="text-xs text-steel">chrome://extensions → Remove "Attendance Interceptor"</p>
            </div>
          </div>
        </section>

        {/* Open source */}
        <section>
          <h2 className="text-lg font-medium text-ink mb-3">Can I verify this?</h2>
          <p className="text-sm text-charcoal leading-relaxed">
            Yes. The extension source code is in the <code className="text-xs font-mono bg-surface px-1 py-0.5 rounded">extension/</code> folder — plain JavaScript, no obfuscation. The app is built from TypeScript source also available in the project. You can read every line of code that runs in your browser.
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-hairline">
        <p className="text-xs text-stone text-center">
          Built for MapmyIndia employees. No external services. No data collection. Your hours, your browser, your business.
        </p>
      </div>
    </div>
  );
}
