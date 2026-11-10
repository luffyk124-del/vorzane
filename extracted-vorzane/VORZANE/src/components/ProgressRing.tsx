/**
 * Adapted from ClimbStack/climbstack-app, src/components/ProgressRing.tsx.
 * Copyright (c) 2026 Giovanni Zanotti. MIT License; see docs/OPEN_SOURCE_RESEARCH.md.
 * Kept as a small isolated component; VORZANE already includes react-native-svg.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface ProgressRingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
  label: string;
  children?: React.ReactNode;
}

const PERCENT = 100;
const START_ANGLE = -90;

export default function ProgressRing({ progress, size, strokeWidth, color, trackColor, label, children }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: PERCENT, now: Math.round(clamped * PERCENT) }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {clamped > 0 ? <Circle cx={center} cy={center} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped)} rotation={START_ANGLE} origin={`${center}, ${center}`} /> : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
