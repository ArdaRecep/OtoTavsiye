"use client";

import { Star } from "lucide-react";

export function RatingStars({
  value,
  previewValue,
  interactive,
  disabled,
  size = "md",
  onPreview,
  onSelect,
  onLeave,
}: {
  value: number;
  previewValue?: number | null;
  interactive?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  onPreview?: (value: number) => void;
  onSelect?: (value: number) => void;
  onLeave?: () => void;
}) {
  const displayValue = previewValue ?? value;
  const iconClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={onLeave}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = Math.max(0, Math.min(1, displayValue - (star - 1))) * 100;

        return (
          <span key={star} className="relative inline-flex">
            <Star className={`${iconClass} text-neutral-300`} />
            <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
              <Star className={`${iconClass} fill-amber-400 text-amber-400`} />
            </span>
            {interactive ? (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onMouseEnter={() => onPreview?.(star - 0.5)}
                  onFocus={() => onPreview?.(star - 0.5)}
                  onClick={() => onSelect?.(star - 0.5)}
                  className="absolute left-0 top-0 h-full w-1/2 disabled:cursor-not-allowed"
                  aria-label={`${star - 0.5} puan ver`}
                />
                <button
                  type="button"
                  disabled={disabled}
                  onMouseEnter={() => onPreview?.(star)}
                  onFocus={() => onPreview?.(star)}
                  onClick={() => onSelect?.(star)}
                  className="absolute right-0 top-0 h-full w-1/2 disabled:cursor-not-allowed"
                  aria-label={`${star} puan ver`}
                />
              </>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
