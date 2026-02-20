/**
 * Design tokens for consistent spacing and dimensions.
 *
 * All structural values follow an 8px grid.
 * Use Tailwind classes directly — these constants exist for documentation
 * and to keep magic values out of component code.
 */

export const DIMENSIONS = {
  /** 48px — standard search bar height */
  searchBarHeight: "h-12",
  /** 56px — minimum row height for touch targets */
  tableRowMinHeight: "min-h-[56px]",
} as const;

export const PADDING = {
  /** 24px — card / container padding (on 8px grid) */
  card: "p-6",
  /** 16px horizontal, 12px vertical — table cell padding */
  tableCell: "px-4 py-3",
} as const;

export const GAP = {
  /** 16px — gap between cards in a grid */
  cardGrid: "gap-4",
  /** 24px — vertical spacing between page sections */
  section: "space-y-6",
} as const;
