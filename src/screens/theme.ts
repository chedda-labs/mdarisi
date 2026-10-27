// Tokens from the Mdarisi Design Spec: forest green carries the brand, sunny
// yellow marks rewards and the main action, everything else stays quiet.
export const colors = {
  green700: "#1E4D3B",
  green900: "#143628",
  green500: "#255C47",
  green100: "#DCEAE2",
  greenText: "#C9DDD2",
  sun400: "#FFC23D",
  sun600: "#D99A12",
  sunText: "#9A6A00",
  sunSoft: "#FFF1CC",
  flame: "#FF8A5B",
  mint: "#9FE0C4",
  ink: "#14231F",
  muted: "#4A5B55",
  ground: "#F3F6F1",
  line: "#E1E8E2",
  pill: "#E6EEE8",
  surface: "#FFFFFF",
};

// Fonts are bundled by the expo-font config plugin; on Android each file's
// name is its family, so every weight is its own family.
export const fonts = {
  heading600: "Baloo2_600SemiBold",
  heading700: "Baloo2_700Bold",
  heading800: "Baloo2_800ExtraBold",
  body400: "Nunito_400Regular",
  body600: "Nunito_600SemiBold",
  body700: "Nunito_700Bold",
  body800: "Nunito_800ExtraBold",
  wordmark: "PlusJakartaSans_800ExtraBold",
};

export const type = {
  title: { fontFamily: fonts.heading800, fontSize: 24, lineHeight: 30, color: colors.ink },
  question: { fontFamily: fonts.heading700, fontSize: 23, lineHeight: 29, color: colors.ink },
  // Baloo 2 has tall line metrics; without these, button labels sit high.
  button: { fontFamily: fonts.heading800, fontSize: 17, lineHeight: 22, includeFontPadding: false, textAlign: "center" as const },
  body: { fontFamily: fonts.body600, fontSize: 16, lineHeight: 23, color: colors.ink },
  eyebrow: { fontFamily: fonts.body800, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase" as const, color: colors.muted },
  caption: { fontFamily: fonts.body700, fontSize: 12, color: colors.muted },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 10, md: 16, lg: 18, card: 24, pill: 999 };
