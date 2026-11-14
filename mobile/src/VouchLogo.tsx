import React from 'react';
import { Image, ImageStyle, StyleProp, useColorScheme } from 'react-native';

// The wordmark is a single transparent PNG; tinting it keeps one asset while
// matching the appearance (white on dark backgrounds, black on light ones).
const LOGO = require('../assets/logo.png');
const RATIO = 750 / 270;

export function VouchLogo({ height = 24, color, style }: { height?: number; color?: string; style?: StyleProp<ImageStyle> }) {
  const scheme = useColorScheme();
  const tint = color ?? (scheme === 'light' ? '#000000' : '#ffffff');
  return (
    <Image
      source={LOGO}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Vouch"
      accessibilityIgnoresInvertColors
      style={[{ width: Math.round(height * RATIO), height, tintColor: tint }, style]}
    />
  );
}
