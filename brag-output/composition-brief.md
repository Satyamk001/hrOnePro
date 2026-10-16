# Hyperframes Composition Brief: Attendance Insights

## Objective
Create a short, polished launch-style brag video for Attendance Insights.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 18.0 seconds

## Source Material
- Project root: `D:/Satyam (CE00172125)/Satyam_Development/attendance-tracker`
- Primary files read: `PRODUCT.md`, `README.md`, `package.json`, `src/index.css`, `src/components/TodayCard.tsx`, `src/components/Dashboard.tsx`
- Product name: Attendance Insights
- Tagline / strongest claim: "Leave on time. Every time. Calculate your exact departure time directly from HROne."
- Key UI or visual moment to recreate:
  - `TodayCard`: First Punch `09:30`, Last Punch `13:45`, Worked `4h 15m`, and the prominent glowing departure badge: `Can leave at 18:30`.
  - `Net Balance` card: `+3h 45m Overtime`, one-click headless sync action.
- Copy that must appear verbatim:
  - "What time can you actually leave today?"
  - "Can leave at 18:30"
  - "Net Balance: +3h 45m"
  - "Zero-install analytics for HROne"
  - "100% Client-Side Privacy"

## Creative Direction
- Tone preset: polished
- Creative direction: Quietly triumphant employee dashboard — stop guessing when you can pack your bag.
- Interpretation: Restrained editorial typography, warm sunshine-orange and cream tones, confident pacing with generous reading holds, clean motion, tactile UI sounds.
- Angle: Employees spend hours doing mental arithmetic in elevators and portals trying to figure out when 9 hours are up. Attendance Insights turns raw punches into instant, indisputable departure clarity.
- Hook: "What time can you actually leave today?"
- Outro / punchline: "Leave on time. Every time."
- Avoid:
  - Generic SaaS language ("streamline your workflows")
  - Abstract filler visuals (floating 3D cubes, meaningless geometric waveforms)
  - Cluttered or unreadable text animations

## Visual Identity
- Background: `#1c1917` (Deep Charcoal canvas) with `#fef9ec` (Warm Cream surface cards)
- Text: `#1c1917` (Deep Ink) on cream cards, `#fafaf9` (On-dark contrast) on dark elements
- Accent: `#f97316` (Primary Orange) & `#f59e0b` (Sunshine Gold), `#16a34a` (Success Emerald)
- Display font: Playfair Display, serif
- Body font: Inter, sans-serif
- Monospace font: JetBrains Mono, monospace
- Visual references from the project:
  - `TodayCard` rounded container with subtle border (`#e7e5e4`) and soft shadow
  - Punch source chips (`BIO`, `WEB`) in monospace
  - Departure time pill with active glowing accent

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract:
1. Scene 1 — The Daily Question — 3.82s (0.00s - 3.82s)
2. Scene 2 — Today's Shift & Departure Target — 5.47s (3.82s - 9.29s)
3. Scene 3 — Net Monthly Balance & Headless Sync — 4.91s (9.29s - 14.20s)
4. Scene 4 — Outro & Brand Lock — 3.80s (14.20s - 18.00s)

## Audio
- Audio role: Warm corporate-indie acoustic bed with tactile UI accents
- Audio arc: Warm opening dilemma → confident working app resolution → celebratory monthly balance → crisp brand lock
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: Starts at 0.0s, steady volume at 0.32, soft fade out from 17.0s to 18.0s
- Music cue guidance: Preset available (`happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`). 
  - Strong cues: 8.74s (departure time pulse), 13.11s (net balance lock), 14.73s (outro logo hit)
  - Beat grid: 109.96 BPM (~0.54s per beat)
- Audio-reactive treatment: Subtle; RMS/bass energy gently warms the amber glow around the departure badge and net balance pill
- Audio-coupled moments:
  - Scene 1 at 0.20s: soft drop (`assets/sfx/interface/drop_001.ogg`)
  - Scene 2 at 4.00s: card place (`assets/sfx/casino/card-place-1.ogg`)
  - Scene 2 at 8.74s: departure pill highlight (`assets/sfx/interface/click_002.ogg`)
  - Scene 3 at 10.50s: mouse click (`assets/sfx/ui/mouseclick1.ogg`)
  - Scene 4 at 14.73s: brand lock bell (`assets/sfx/impact/impactBell_heavy_000.ogg`)
- SFX files to copy:
  - `interface/drop_001.ogg`
  - `casino/card-place-1.ogg`
  - `interface/click_002.ogg`
  - `ui/mouseclick1.ogg`
  - `impact/impactBell_heavy_000.ogg`

## Hyperframes Instructions
Requirements:
- Show real UI components (`TodayCard`, punch chips, departure pill, Net Balance card).
- Keep all text readable in the final render.
- Keep the video duration strictly at 18.0 seconds.
- Copy music and SFX into `brag-output/composition/assets/`.
- Validate via `npx hyperframes check` before rendering.
- Render locally to `brag-output/brag.mp4`.
