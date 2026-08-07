import { Platform } from "react-native";

/**
 * Before You Say It visual language — "final purple".
 *
 * A cool luminous field cooling into violet, translucent layers sitting a
 * measurable distance off it, and one saturated purple surface per screen
 * carrying the single action that matters. One geometric sans; weight and
 * size carry hierarchy, so nothing needs a second typeface.
 */
export const C = {
  /** Field — base tone under the three radial glows in `Backdrop`. */
  bg: "#F2F2F6",
  /** Glow stops, in the order they are painted over `bg`. */
  glowTop: "#FDFDFE",
  glowRight: "#DFDCEC",
  glowBottom: "#DED5EA",
  /** Deepest corner of the field — the tone the violet settles to. */
  fieldDeep: "#DEDCE8",
  elevated: "#FDFDFE",

  /**
   * Layer fills. Translucent on purpose: over the field these read as glass
   * without paying for a blur pass on every card.
   */
  surface: "rgba(255,255,255,0.52)",
  /** Selected rows and raised inputs. */
  surfaceHigh: "rgba(255,255,255,0.62)",
  /** The docked footer bar — the one place a second real blur is allowed. */
  bar: "rgba(255,255,255,0.42)",
  /**
   * Fallback for the docked bar where no blur is available (web). Nearly
   * opaque, so content scrolling underneath cannot muddy the action sitting
   * on top of it.
   */
  barSolid: "rgba(247,247,250,0.97)",
  /** Top-light hairline that gives a layer its edge. */
  glassEdge: "rgba(255,255,255,0.62)",
  barEdge: "rgba(255,255,255,0.50)",

  line: "rgba(23,26,31,0.10)",
  lineStrong: "rgba(23,26,31,0.20)",
  /** Inert track behind meters and progress bars. */
  track: "#D3D5DB",
  scrim: "rgba(0,0,0,0.35)",

  text: "#171A1F",
  textSoft: "#4B5259",
  textDim: "#5B646E",
  dim: "#646D77",
  /** Disabled type sits at `dim` — legible, not ghosted. */
  disabled: "#646D77",

  /** Purple — primary. Reserved for the one thing to do next. */
  purple: "#512888",
  /** Pressed state for the primary button. */
  purplePressed: "#3C1D66",
  purpleDeep: "#4A2380",
  purpleMid: "#63409B",
  purpleLight: "#7B62AC",
  purpleSoft: "rgba(81,40,136,0.10)",

  /**
   * Semantics — score and tension only, never decoration.
   *
   * Naming note: the handoff spec calls #B4823F "clay" and #B1402F "danger".
   * This file predates that and calls them `amber` and `clay`. Both hexes are
   * correct and render correctly; only the names differ. Reading the spec and
   * reaching for `C.clay` will get you the red, not the amber — check the hex.
   * The rename is deferred so it lands in one pass rather than screen by screen.
   */
  sage: "#5C8A6E",
  sageSoft: "rgba(92,138,110,0.12)",
  /** Spec name: `clay`. Caution, verdict tier, tension. */
  amber: "#B4823F",
  /** Spec name: `danger`. */
  clay: "#B1402F",
  claySoft: "rgba(177,64,47,0.10)",

  onAccent: "#FFFFFF",
} as const;

/** Lilac → royal purple, for the single hero surface on a screen. */
export const HERO_GRADIENT = [
  C.purpleDeep,
  C.purple,
  C.purpleMid,
  C.purpleLight,
] as const;

/**
 * The field is three radial glows over `C.bg`, not a linear ramp. Each entry is
 * `[centreX, centreY, radiusX, radiusY]` as a fraction of the screen, matching
 * the design's `radial-gradient(... at x y)` stack in paint order.
 */
export const FIELD_GLOWS = [
  { color: C.glowTop, x: 0.15, y: 0, rx: 1.25, ry: 0.75 },
  { color: C.glowRight, x: 1, y: 0.18, rx: 1.15, ry: 0.7 },
  { color: C.glowBottom, x: 0.55, y: 1.05, rx: 1.4, ry: 0.85 },
] as const;

/**
 * Plus Jakarta Sans, bundled as four static weights. React Native selects a
 * face by family name rather than by `fontWeight`, so weights are addressed
 * as separate families.
 */
export const font = {
  regular: "PlusJakartaSans-400",
  medium: "PlusJakartaSans-500",
  semi: "PlusJakartaSans-600",
  bold: "PlusJakartaSans-700",
} as const;

/** Font assets, keyed by the family names above. */
export const FONT_ASSETS = {
  "PlusJakartaSans-400": require("../assets/fonts/PlusJakartaSans-400.ttf"),
  "PlusJakartaSans-500": require("../assets/fonts/PlusJakartaSans-500.ttf"),
  "PlusJakartaSans-600": require("../assets/fonts/PlusJakartaSans-600.ttf"),
  "PlusJakartaSans-700": require("../assets/fonts/PlusJakartaSans-700.ttf"),
} as const;

/**
 * Six steps, down from twelve. Anything not on this scale is a mistake.
 */
export const type = {
  /** Screen-opening statement. One per screen. */
  display: {
    fontFamily: font.semi,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.3,
    color: C.text,
  },
  /** Card and section titles, and spoken counterpart lines. */
  title: {
    fontFamily: font.semi,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: C.text,
  },
  /** Everything the user reads at length. */
  body: {
    fontFamily: font.regular,
    fontSize: 17,
    lineHeight: 26,
    color: C.text,
  },
  /** Secondary explanation and list metadata. */
  support: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: C.textSoft,
  },
  /** Trust notes, timestamps, disclosures. */
  caption: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.textDim,
  },
} as const;

/** Short alias, so screens can write `T.body` without shadowing the `type` keyword. */
export const T = type;

/** Signature element, kept exactly as built. */
export const eyebrow = {
  fontFamily: font.semi,
  fontSize: 11,
  letterSpacing: 1.6,
  textTransform: "uppercase" as const,
};

/**
 * Retained so screens that have not been moved onto `type` yet still render in
 * the product typeface rather than falling back to the system sans.
 */
export const display = font.semi;

export const mono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, monospace",
}) as string;

export const bold = "700" as const;
export const semi = "600" as const;
export const medium = "500" as const;

/** Single horizontal gutter. Every screen, no exceptions. */
export const GUTTER = 22;

/** Vertical rhythm. */
export const space = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 } as const;

export const radius = {
  sm: 14,
  md: 18,
  /** Cards and raised layers — glass, hero, and every full-width surface. */
  lg: 28,
  /** Primary and ghost buttons. */
  button: 18,
  /** Chips, filters, and the mic. */
  pill: 999,
} as const;

/**
 * Depth carries the hierarchy now that borders are mostly gone. React Native
 * allows one shadow per view, so the design's three-stop stack is collapsed
 * into a single equivalent per elevation level.
 */
export const shadow = {
  /** Resting glass layers. */
  layer: {
    shadowColor: "#1C2430",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  /** The one hero surface on a screen, and the primary button. */
  hero: {
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 10,
  },
  /** The rehearsal state dock. */
  dock: {
    shadowColor: "#1C2430",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 12,
  },
} as const;
