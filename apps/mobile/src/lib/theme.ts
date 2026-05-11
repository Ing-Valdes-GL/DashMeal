// ─── Dash Meal — Nectar-inspired Design System ────────────────────────────────

export const Colors = {
  // Backgrounds (light app)
  bg:        "#FFFFFF",
  pageBg:    "#F2F3F2",
  card:      "#FFFFFF",
  inputBg:   "#F2F3F2",

  // Brand — Nectar green
  primary:      "#53B175",
  primaryLight: "#F2F9F0",
  primaryDark:  "#3E8C58",

  // Text (light)
  text:    "#181725",
  text2:   "#7C7C7C",
  text3:   "#B3B3B3",

  // Status
  success: "#53B175",
  error:   "#F44336",
  warning: "#FFC107",
  info:    "#2196F3",

  // Borders
  border:  "#E2E2E2",
  divider: "#F2F3F2",

  // Tabs
  tabActive:   "#53B175",
  tabInactive: "#B3B3B3",

  // Dark surfaces — used by auth screens (welcome, login, register, otp)
  darkBg:    "#0D0D0D",
  darkInput: "rgba(255,255,255,0.07)",
  textDark2: "rgba(255,255,255,0.55)",
} as const;

export const Radius = {
  xs:   4,
  sm:   8,
  md:   14,
  lg:   18,
  xl:   24,
  xxl:  32,
  full: 999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  primary: {
    shadowColor: "#53B175",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;
