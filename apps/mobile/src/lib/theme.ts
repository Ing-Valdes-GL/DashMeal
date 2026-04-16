// ─── Dash Meal — Design System ────────────────────────────────────────────────
// Basé sur le Figma "Food Delivery App Community"

export const Colors = {
  // Backgrounds
  bg:        "#FFFFFF",
  pageBg:    "#F8F9FA",
  card:      "#FFFFFF",
  inputBg:   "#F5F5F8",

  // Auth (dark)
  darkBg:    "#1B2138",
  darkSurf:  "#252B47",
  darkInput: "#2C3454",

  // Brand
  primary:      "#FF7A2F",
  primaryLight: "rgba(255, 122, 47, 0.12)",
  primaryDark:  "#E86520",

  // Text
  text:       "#1C1C1E",
  text2:      "#747474",
  text3:      "#ABABAB",
  textDark:   "#FFFFFF",   // text on dark bg
  textDark2:  "#A0A8C0",

  // Status
  success:   "#4CAF50",
  error:     "#F44336",
  warning:   "#FFC107",
  info:      "#2196F3",

  // Borders
  border:    "#EBEBEB",
  divider:   "#F0F0F0",

  // Tab bar
  tabActive:   "#FF7A2F",
  tabInactive: "#BDBDBD",
} as const;

export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  primary: {
    shadowColor: "#FF7A2F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const Typography = {
  h1:    { fontSize: 28, fontWeight: "800" as const, color: Colors.text },
  h2:    { fontSize: 22, fontWeight: "700" as const, color: Colors.text },
  h3:    { fontSize: 18, fontWeight: "600" as const, color: Colors.text },
  h4:    { fontSize: 16, fontWeight: "600" as const, color: Colors.text },
  body:  { fontSize: 14, fontWeight: "400" as const, color: Colors.text2 },
  small: { fontSize: 12, fontWeight: "400" as const, color: Colors.text3 },
  label: { fontSize: 13, fontWeight: "500" as const, color: Colors.text2 },
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;
