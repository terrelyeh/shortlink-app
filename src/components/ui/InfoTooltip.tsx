"use client";

/**
 * Lightweight tooltip — replaces native `title` attribute when we need:
 *   - No 1-2s browser hover delay
 *   - Multi-line wrapping
 *   - Override of inherited table-header styles (uppercase, letter-spacing)
 *
 * Hover the ⓘ icon → bubble appears beneath. Mouse-leave hides. Touch
 * devices: tap to toggle (the click handler also fires on touch).
 *
 * Width is fixed at 280px to keep wrapping predictable; longer copy
 * should be split across multiple Tooltips or moved to the help notes.
 */

import { useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  text: string;
  /** Anchor side; defaults to "right" so tooltip flows under the icon
      without escaping the right-aligned column header. */
  align?: "left" | "right";
}

export function InfoTooltip({ text, align = "right" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        // Allow tap-to-toggle on touch devices. Stop propagation so the
        // tooltip click doesn't bubble to a sortable column header etc.
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      <Info size={11} style={{ opacity: 0.6, cursor: "help" }} />
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align === "right" ? "right" : "left"]: 0,
            background: "var(--ink-100)",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.5,
            width: 280,
            whiteSpace: "normal",
            // Reset header styles that would otherwise inherit (the th
            // uses uppercase + letter-spacing for column labels).
            textTransform: "none",
            letterSpacing: 0,
            textAlign: "left",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
