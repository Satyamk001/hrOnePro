# Meet-UI Integration Guide

How to transform existing Attendance Insights components into meet-ui inspired animated components — without breaking existing code or changing the color theme.

## Prerequisites

Install the one required dependency:

```bash
npm install framer-motion
```

Meet-UI components use `framer-motion` for animations. No other external dependencies are needed — we'll adapt the components to use our existing Tailwind setup and CSS variables.

## Strategy

- **Copy, don't import** — take the component source from `meet-ui/src/components/ui/`, adapt to our project
- **Keep existing colors** — replace meet-ui's hardcoded colors with our CSS variable tokens
- **Remove `"use client"`** — not needed in Vite/React (that's a Next.js directive)
- **Replace `@/lib/utils`** — meet-ui uses a `cn()` utility; we'll use a simple inline version or install `clsx`
- **Incremental adoption** — each component can be swapped independently

## Utility Setup

Create `src/utils/cn.ts`:

```ts
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

## Component Mapping

| Your Component | Meet-UI Enhancement | Impact |
|---|---|---|
| Net Balance hero number | `AnimatedCounter` | Number rolls up on load |
| Dashboard metric cells | `GlowCard` (simplified) | Subtle glow on hover |
| Month headings | `BlurReveal` | Words fade in with blur |
| Onboarding title | `TypewriterText` | Types out "Know your hours in seconds" |
| Sync button | `ShinyCTA` | Animated border glow |
| Table row hover | CSS only | Subtle lift + glow border |
| Profile panel sections | `BlurReveal` (on first load) | Fade-in stagger |
| Yesterday summary card | `wave-card` background (simplified) | Animated gradient background |

---

## 1. AnimatedCounter — Net Balance Hero

**Where:** `Dashboard.tsx` — the large `+4h 32m` net balance display

**Current:**
```tsx
<p className="font-display text-5xl font-medium tracking-display">
  {netBalanceFormatted}
</p>
```

**After:** Copy `meet-ui/src/components/ui/animated-counter.tsx` to `src/components/ui/AnimatedCounter.tsx`.

Adaptations needed:
1. Remove `"use client"` 
2. Replace `import { cn } from "@/lib/utils"` with `import { cn } from "../../utils/cn"`
3. Keep framer-motion imports as-is

**Usage:**
```tsx
import AnimatedCounter from "./ui/AnimatedCounter";

// In Dashboard hero section:
<div className="flex items-baseline gap-1">
  {netBalanceMinutes >= 0 ? "+" : "-"}
  <AnimatedCounter 
    value={Math.floor(Math.abs(netBalanceMinutes) / 60)} 
    duration={1.5} 
    suffix="h" 
    separator={false}
    className="font-display text-5xl font-medium tracking-display"
  />
  <AnimatedCounter 
    value={Math.abs(netBalanceMinutes) % 60} 
    duration={1.5} 
    delay={0.3}
    suffix="m" 
    separator={false}
    className="font-display text-5xl font-medium tracking-display"
  />
</div>
```

**Color note:** Apply the existing color class (`text-primary`, `text-error`, `text-ink`) to the wrapper div.

---

## 2. BlurReveal — Section Headings

**Where:** Month heading in main content, onboarding title

**Current:**
```tsx
<h2 className="font-display text-3xl font-medium text-ink tracking-display">
  {activeLabel}
</h2>
```

**After:** Copy `meet-ui/src/components/ui/blur-reveal.tsx` to `src/components/ui/BlurReveal.tsx`.

Adaptations:
1. Remove `"use client"`
2. Inline the `cn` function (already included in the component)
3. Framer-motion imports stay

**Usage:**
```tsx
import { BlurReveal } from "./ui/BlurReveal";

<BlurReveal 
  text={activeLabel || ""} 
  className="font-display text-3xl font-medium text-ink tracking-display"
  duration={0.6}
/>
```

---

## 3. TypewriterText — Onboarding Hero

**Where:** The "Know your hours in seconds" heading on the setup page

**Current:**
```tsx
<h2 className="font-display text-4xl font-medium text-ink tracking-display mb-3">
  Know your hours in seconds
</h2>
```

**After:** Copy `meet-ui/src/components/ui/typewriter-text.tsx` to `src/components/ui/TypewriterText.tsx`.

**Usage:**
```tsx
import { TypewriterText } from "./ui/TypewriterText";

<TypewriterText 
  text="Know your hours in seconds" 
  speed={60} 
  loop={false} 
  cursor={false}
  className="font-display text-4xl font-medium text-ink tracking-display mb-3"
/>
```

---

## 4. GlowCard — Dashboard Metrics

**Where:** The small metric cells (Worked Days, Present, Late, etc.)

This is a **simplified adaptation** — we don't need the orbiting dot or grid lines. Just the subtle glow border on hover.

**Create** `src/components/ui/GlowHoverCard.tsx`:

```tsx
import { cn } from "../../utils/cn";

interface GlowHoverCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlowHoverCard({ children, className, glowColor = "var(--color-primary)" }: GlowHoverCardProps) {
  return (
    <div 
      className={cn(
        "relative rounded-lg border border-hairline bg-canvas p-4 shadow-subtle transition-shadow duration-300",
        "hover:shadow-[0_0_15px_-3px_var(--glow)]",
        className
      )}
      style={{ "--glow": glowColor } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
```

**Usage in Dashboard.tsx:**
```tsx
// Replace the Cell component wrapper:
function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlowHoverCard>
      <p className="text-[11px] text-steel uppercase tracking-wide mb-1">{label}</p>
      <p className="font-display text-2xl font-medium text-ink tracking-heading">{value}</p>
      {sub && <p className="text-[11px] text-stone mt-0.5">{sub}</p>}
    </GlowHoverCard>
  );
}
```

---

## 5. ShinyCTA — Sync Button

**Where:** The "Sync" button in the header

**Adaptation:** The full ShinyCTA is dark-themed with a pill shape. For our orange primary button, simplify to just the animated border glow.

**Create** `src/components/ui/ShinyButton.tsx`:

```tsx
import { cn } from "../../utils/cn";

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export function ShinyButton({ children, className, ...props }: ShinyButtonProps) {
  return (
    <button
      className={cn(
        "relative overflow-hidden rounded-md px-4 h-9 inline-flex items-center gap-2 text-sm font-medium transition-all",
        "bg-primary text-white hover:bg-primary-deep",
        "before:absolute before:inset-0 before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)]",
        "before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

This gives a shimmer effect on hover without changing the button's color theme.

---

## 6. SparklesText — Net Balance (positive)

**Where:** Only when net balance is positive (celebration moment)

**Usage (optional, use sparingly):**
```tsx
import { SparklesText } from "./ui/SparklesText";

// Only when positive balance:
{isPositive && (
  <SparklesText 
    text={netBalanceFormatted} 
    colors={{ first: "#f97316", second: "#fbbf24" }}
    className="font-display text-5xl font-medium tracking-display text-primary"
    sparklesCount={6}
  />
)}
```

Colors use our primary orange and yellow-saturated — stays on-brand.

---

## 7. SplitTextReveal — Page Title

**Where:** "Attendance Insights" in the header (subtle, one-time on first load)

Copy `meet-ui/src/components/ui/split-text-reveal.tsx` → `src/components/ui/SplitTextReveal.tsx`

**Usage:**
```tsx
<SplitTextReveal 
  text="Attendance Insights" 
  className="font-display text-lg font-medium text-ink tracking-display"
  duration={1}
  stagger={0.03}
  once={true}
/>
```

---

## Implementation Order (recommended)

1. **Install framer-motion** — `npm install framer-motion`
2. **Create `src/utils/cn.ts`** — utility function
3. **GlowHoverCard** — easiest win, just CSS hover glow on metric cards
4. **ShinyButton** — CSS-only shimmer on Sync button
5. **BlurReveal** — heading animations (low risk, additive)
6. **AnimatedCounter** — number rollup for net balance
7. **TypewriterText** — onboarding page title
8. **SparklesText** — optional celebration for positive balance

## What NOT to Change

- **Color variables** — keep all CSS custom properties as-is
- **Layout structure** — don't change flex/grid arrangements
- **Data flow** — animations are purely presentation layer
- **Dark mode** — all animations should work in both themes (they use `currentColor` and CSS variables)
- **Existing className props** — pass them through to the animated wrappers

## Performance Notes

- `framer-motion` adds ~30KB gzipped to the bundle
- All animations use `will-change: transform` and GPU-composited properties
- `useInView` with `once: true` prevents re-triggering
- For the table (many rows), avoid per-row animations — use CSS transitions only
- `AnimatedCounter` only triggers when scrolled into view

## File Structure After Integration

```
src/
├── components/
│   ├── ui/                      # NEW — meet-ui adapted components
│   │   ├── AnimatedCounter.tsx
│   │   ├── BlurReveal.tsx
│   │   ├── GlowHoverCard.tsx
│   │   ├── ShinyButton.tsx
│   │   ├── SparklesText.tsx
│   │   ├── SplitTextReveal.tsx
│   │   └── TypewriterText.tsx
│   ├── Dashboard.tsx            # Uses AnimatedCounter, GlowHoverCard
│   ├── DayTable.tsx             # No changes (CSS hover only)
│   ├── ProfilePanel.tsx         # BlurReveal on sections
│   └── PrivacyPage.tsx          # No changes
├── utils/
│   ├── cn.ts                    # NEW — class name utility
│   ├── classifier.ts
│   ├── parser.ts
│   └── timeCalculator.ts
```
