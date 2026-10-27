import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, fonts, radius, type } from "./theme";

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce, () => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

const BUTTONS = {
  primary: { face: colors.green700, shadow: colors.green900, text: colors.surface, border: undefined },
  sun: { face: colors.sun400, shadow: colors.sun600, text: colors.ink, border: undefined },
  secondary: { face: colors.surface, shadow: undefined, text: colors.green900, border: colors.green700 },
  secondaryOnGreen: { face: "transparent", shadow: undefined, text: colors.surface, border: colors.greenText },
};

// Chunky button on a solid shadow; it presses down onto the shadow when tapped.
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof BUTTONS;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = BUTTONS[variant];
  const drop = v.shadow ? 4 : 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[{ borderRadius: radius.md, backgroundColor: v.shadow, opacity: disabled ? 0.45 : 1 }, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.buttonFace,
            { backgroundColor: v.face, marginBottom: pressed ? 0 : drop, marginTop: pressed ? drop : 0 },
            v.border && { borderWidth: 2, borderColor: v.border },
          ]}
        >
          <Text style={[type.button, { color: v.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// Kitabu: an open book with a four-point sparkle above the gutter.
export function BookMark({ size, color = colors.green700, sparkle = color }: { size: number; color?: string; sparkle?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M12 0.8L12.8 3L15 3.8L12.8 4.6L12 6.8L11.2 4.6L9 3.8L11.2 3Z" fill={sparkle} />
      <Path d="M2.5 9Q7 7.5 11.2 9.3V22Q7 20.3 2.5 21.6Z" fill={color} />
      <Path d="M21.5 9Q17 7.5 12.8 9.3V22Q17 20.3 21.5 21.6Z" fill={color} />
    </Svg>
  );
}

// The app icon: green Kitabu on a sunny-yellow rounded square.
export function AppIcon({ size, shadow }: { size: number; shadow?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="Mdarisi"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        backgroundColor: colors.sun400,
        alignItems: "center",
        justifyContent: "center",
        ...(shadow && { borderBottomWidth: 8, borderBottomColor: colors.sun600 }),
      }}
    >
      <BookMark size={size * 0.62} />
    </View>
  );
}

export function Wordmark({ size, color }: { size: number; color: string }) {
  return <Text style={{ fontFamily: fonts.wordmark, fontSize: size, lineHeight: size * 1.15, letterSpacing: -0.02 * size, color }}>mdarisi</Text>;
}

// Mwalimu, the tutor: a yellow face on green. Kept apart from the logo.
export function MwalimuAvatar({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.green700, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={8} fill={colors.sun400} />
        <Circle cx={9.3} cy={11} r={1.3} fill={colors.ink} />
        <Circle cx={14.7} cy={11} r={1.3} fill={colors.ink} />
        <Path d="M9 14.5c1.6 1.6 4.4 1.6 6 0" fill="none" stroke={colors.ink} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

type IconName = "star" | "check" | "cross" | "send" | "bulb";

export function Icon({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  const stroke = { fill: "none", stroke: color, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "star" && <Path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21l1.5-7L2 9.3l7-.8z" fill={color} />}
      {name === "check" && <Path d="M5 12l5 5 9-10" {...stroke} />}
      {name === "cross" && <Path d="M7 7l10 10M17 7L7 17" {...stroke} />}
      {name === "send" && <Path d="M5 12h13M13 6l6 6-6 6" {...stroke} strokeWidth={2.6} />}
      {name === "bulb" && (
        <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" {...stroke} strokeWidth={2.2} />
      )}
    </Svg>
  );
}

export function XpPill({ xp, onWhite = true }: { xp: number; onWhite?: boolean }) {
  return (
    <View style={styles.xp} accessible accessibilityLabel={`${xp} XP`}>
      <Icon name="star" size={20} color={colors.sun400} />
      <Text style={[styles.xpText, { color: onWhite ? colors.sunText : colors.sun400 }]}>{xp}</Text>
    </View>
  );
}

export function ProgressBar({ value, track, fill, height = 14 }: { value: number; track: string; fill: string; height?: number }) {
  return (
    <View style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: fill }} />
    </View>
  );
}

const styles = StyleSheet.create({
  buttonFace: { minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  xp: { flexDirection: "row", alignItems: "center", gap: 4 },
  xpText: { fontFamily: fonts.heading800, fontSize: 17 },
});
