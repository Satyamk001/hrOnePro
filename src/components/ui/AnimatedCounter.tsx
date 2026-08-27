import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { cn } from "../../utils/cn"

interface AnimatedCounterProps {
  value?: number
  duration?: number
  delay?: number
  prefix?: string
  suffix?: string
  separator?: boolean
  continuous?: boolean
  className?: string
}

function RollingDigit({
  targetDigit,
  duration,
  shouldAnimate,
}: {
  targetDigit: number
  duration: number
  delay: number
  shouldAnimate: boolean
}) {
  const [displayDigit, setDisplayDigit] = useState(shouldAnimate ? 0 : targetDigit)
  const prevDigitRef = useRef(displayDigit)

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayDigit(targetDigit)
      return
    }
    setDisplayDigit(targetDigit)
  }, [targetDigit, shouldAnimate])

  const direction = targetDigit >= prevDigitRef.current ? 1 : -1
  prevDigitRef.current = targetDigit

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        width: "0.6em",
        height: "1em",
        lineHeight: "1em",
        verticalAlign: "baseline",
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={displayDigit}
          initial={shouldAnimate ? { y: `${direction * 100}%`, opacity: 0 } : false}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: `${-direction * 100}%`, opacity: 0 }}
          transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {displayDigit}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * Decompose a non-negative integer value into display elements
 * (digit entries and separator entries).
 */
export function decomposeValue(
  absValue: number,
  separator: boolean
): Array<{ type: "digit"; digit: number; index: number } | { type: "sep" }> {
  const digitChars = String(absValue).split("")
  const displayElements: Array<
    { type: "digit"; digit: number; index: number } | { type: "sep" }
  > = []
  const totalDigits = digitChars.length

  digitChars.forEach((ch, i) => {
    displayElements.push({ type: "digit", digit: Number(ch), index: i })
    const fromRight = totalDigits - 1 - i
    if (separator && fromRight > 0 && fromRight % 3 === 0) {
      displayElements.push({ type: "sep" })
    }
  })

  return displayElements
}

export default function AnimatedCounter({
  value = 0,
  duration = 2,
  delay = 0,
  prefix = "",
  suffix = "",
  separator = true,
  continuous = false,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-10%" })
  const prevValueRef = useRef<number | null>(null)

  // Handle NaN → treat as 0
  const safeValue = Number.isNaN(value) ? 0 : value

  // Track which digits changed
  const absValue = Math.floor(Math.abs(safeValue))
  const prevAbs =
    prevValueRef.current !== null
      ? Math.floor(Math.abs(prevValueRef.current))
      : null

  const currentDigits = String(absValue).split("")
  const prevDigits = prevAbs !== null ? String(prevAbs).split("") : null

  // Determine which digit positions actually changed
  // We compare from the right to handle length changes properly
  const changedPositions = new Set<number>()

  if (prevDigits !== null) {
    // Pad the shorter array with a sentinel value from the left
    const maxLen = Math.max(currentDigits.length, prevDigits.length)
    const currPadded = currentDigits.slice()
    const prevPadded = prevDigits.slice()

    while (currPadded.length < maxLen) currPadded.unshift("")
    while (prevPadded.length < maxLen) prevPadded.unshift("")

    // Map back to current digit indices
    const offset = maxLen - currentDigits.length
    for (let i = 0; i < maxLen; i++) {
      if (currPadded[i] !== prevPadded[i]) {
        const currentIndex = i - offset
        if (currentIndex >= 0) {
          changedPositions.add(currentIndex)
        }
      }
    }
  }

  // Update previous value ref after computing changes
  useEffect(() => {
    prevValueRef.current = safeValue
  })

  const displayElements = decomposeValue(absValue, separator)

  // Determine if animation should be active
  const isActive = continuous || isInView

  // For first-view mode (non-continuous), all digits animate from 0 on first view
  // For continuous mode, only changed digits animate
  const isFirstView = prevDigits === null

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center font-bold tabular-nums",
        className
      )}
    >
      {prefix && <span className="mr-[0.05em]">{prefix}</span>}
      {safeValue < 0 && <span>−</span>}
      {displayElements.map((el, i) => {
        if (el.type === "sep") {
          return (
            <span key={`s${i}`} className="inline-block w-[0.3em] text-center">
              ,
            </span>
          )
        }

        // Determine if this specific digit should animate
        let shouldAnimate: boolean
        if (!isActive) {
          // Not in view yet (first-view mode) — don't animate
          shouldAnimate = false
        } else if (isFirstView) {
          // First time becoming visible — animate all digits from 0
          shouldAnimate = true
        } else if (continuous) {
          // Continuous mode — only animate changed digits
          shouldAnimate = changedPositions.has(el.index)
        } else {
          // Subsequent updates in first-view mode — animate changed digits
          shouldAnimate = changedPositions.has(el.index)
        }

        return (
          <RollingDigit
            key={`d${el.index}`}
            targetDigit={isActive ? el.digit : 0}
            duration={duration}
            delay={isFirstView && isActive ? delay + el.index * 0.1 : 0}
            shouldAnimate={shouldAnimate}
          />
        )
      })}
      {suffix && <span className="ml-[0.05em]">{suffix}</span>}
    </span>
  )
}
