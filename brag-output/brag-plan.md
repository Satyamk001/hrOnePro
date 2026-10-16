# Brag Plan: Attendance Insights

## What is this app?
Attendance Insights is a zero-install attendance analytics dashboard and companion extension for HROne users that turns raw biometric/portal punches into live shift countdowns, overtime/shortfall calculations, and net monthly balance.

## The angle
The quiet triumph of packing your bag at the exact minute your shift ends. Instead of wrestling with HROne's delayed monthly calendar or calculating hours on a calculator, Attendance Insights gives you the one number that actually matters: the exact minute you can leave, down to the second.

## Hook (first 2-3 seconds)
"What time can you actually leave today?"
No corporate preamble. Straight to the daily question every employee asks by 3:00 PM.

## Key moments (the middle)
- **Live Intraday Punch Tracking**: `TodayCard` recreates live punches (First Punch `09:30`, Last Punch `13:45`, Worked `4h 15m`).
- **Target Departure Calculation**: The glowing hero pill calculates **`Can leave at 18:30`** with real-time countdown.
- **Net Monthly Balance**: Hero metric card showing `+3h 45m` Overtime with one-click headless background sync.

## Outro / punchline
"Leave on time. Every time."
Attendance Insights — Zero-install analytics for HROne.

## User flow worth showing
1. Entry: Employee punches in at HROne portal / biometric scanner.
2. Live Action: Attendance Insights detects punches via extension/bookmarklet; `TodayCard` counts live work hours and projects exact departure time (`18:30`).
3. Result: Net balance shows `+3h 45m` overtime; user clocks out with total peace of mind.

## Tone
- Preset: polished
- Creative direction: Quietly triumphant employee dashboard — stop guessing when you can pack your bag.
- Interpretation: Restrained editorial typography, warm sunshine-orange and cream tones, confident pacing with generous reading holds, clean motion, tactile UI sounds.

## Format: landscape — 1920x1080
## Duration: 18.0s

## Visual identity (from the project)
- Background: `#fef9ec` (Cream) / `#1c1917` (Dark Charcoal canvas)
- Accent: `#f97316` (Primary Orange) & `#f59e0b` (Sunshine Gold)
- Text: `#1c1917` (Deep Ink) & `#fafaf9` (On-dark contrast)
- Display font: Playfair Display, serif
- Body font: Inter, sans-serif
- Monospace font: JetBrains Mono, monospace
- Strongest visual element: The glassmorphism `TodayCard` with live departure target pill and interactive punch chips.

## Share copy (draft)
Stop doing mental math in the elevator: Attendance Insights calculates your exact departure time and monthly overtime balance directly from HROne.

## Audio direction
- Role: warm corporate-indie bed with tactile UI accents and confident cadence
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: Starts at 0.0s, steady volume at 0.32, soft fade out from 17.0s to 18.0s
- Music cue guidance: Preset available (tempo 109.96 BPM). Target strong cue at 8.74s for departure calculation lock, 13.11s for Net Balance count-up, and 14.73s/17.47s for final logo payoff
- Audio-reactive treatment: subtle; music RMS gently warms the glowing accent borders of the departure badge and net balance card
- SFX posture: moderate; professional tactile clicks, card drops, and one resonant bell on the final logo lock
- Audio-coupled moments:
  - Scene 1: soft drop as headline card settles (`interface/drop_001.ogg`)
  - Scene 2: card entry and departure pill lock (`casino/card-place-1.ogg`, `interface/click_002.ogg`)
  - Scene 3: cursor click on Sync button (`ui/mouseclick1.ogg`)
  - Scene 4: final logo lock (`impact/impactBell_heavy_000.ogg`)
- Restraint rule: No loud whooshes, no aggressive distortion; preserve editorial polish and acoustic clarity.

## Storyboard

### Scene 1 — The Daily Question — 3.82s (0.00s - 3.82s)
The question every employee asks themselves. Clean, warm cream card on deep charcoal canvas.
- Display Text: *"What time can you actually leave today?"*
- Subline: *"Stop doing mental math in the elevator."*
- Sequential/interaction: Card slides up smoothly, text reveals with crisp typography.
- Audio intent: Sets up the relatable workplace dilemma with a warm acoustic beat.
- Audio-coupled idea: Soft drop accent at 0.20s as card settles into frame.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (volume 0.32)
- Transition mood: Clean slide transition → Scene 2

### Scene 2 — Today's Shift & Departure Target — 5.47s (3.82s - 9.29s)
Recreates the live `TodayCard` from Attendance Insights.
- Visual elements:
  - Header: `TODAY'S SHIFT` • `Standard Shift: 9h 00m`
  - Punch chips: `BIO 09:30` (First Punch) • `WEB 13:45` (Last Punch)
  - Live worked counter: `4h 15m`
  - Hero Departure Badge: **`Can leave at 18:30`** with live remaining countdown `04:45:00 remaining`.
- Sequential/interaction: Punches land sequentially, followed by the departure calculation glowing into view.
- Audio intent: Satisfaction of knowing exactly when you are done.
- Audio-coupled idea: Card place SFX at 4.00s; departure calculation locks near strong cue at 8.74s.
- Transition mood: Smooth horizontal wipe → Scene 3

### Scene 3 — Net Monthly Balance & Headless Sync — 4.91s (9.29s - 14.20s)
The cumulative monthly dashboard and instant sync.
- Visual elements:
  - Hero Stat Card: `NET BALANCE` → **`+3h 45m`** Overtime (emerald/amber glow)
  - Detail metrics: `18 Days Present` • `0 Shortfall` • `100% Client-Side Privacy`
  - Interactive element: Simulated cursor clicks `Sync` button → badge switches to `Synced Just Now`.
- Sequential/interaction: Mouse click on Sync triggers instant balance update and overtime badge pulse.
- Audio intent: Confidence and accomplishment.
- Audio-coupled idea: Mouse click SFX (`ui/mouseclick1.ogg`) at 10.50s; metric lock at strong cue 13.11s.
- Transition mood: Soft crossfade → Scene 4

### Scene 4 — Outro & Brand Lock — 3.80s (14.20s - 18.00s)
The definitive solution for HROne users.
- Visual elements:
  - App Title: **Attendance Insights**
  - Tagline: *"Leave on time. Every time."*
  - Deployment badges: `Chrome Extension` • `Bookmarklet` • `npx attendance-insights`
- Sequential/interaction: Title scales into place, badges fade in consecutively, final hold.
- Audio intent: Complete resolution and brand trust.
- Audio-coupled idea: Bell resonance (`impact/impactBell_heavy_000.ogg`) at 14.73s, music fades out by 18.00s.

**Music mood for this video:** Upbeat, clean, polished corporate-indie
**Audio summary:** Warm acoustic rhythm carrying a problem-to-solution arc, punctuated by tactile UI clicks and a resonant outro finish.
