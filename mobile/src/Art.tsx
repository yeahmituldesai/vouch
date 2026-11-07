import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Idea } from './types';

const L = '#e5e5e7';
export function ArtGlyph({ category, size }: { category: Idea['category']; size: number }) {
  const common = { fill: 'none', stroke: L, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const vb = category === 'Clothing' ? '0 0 140 140' : '0 0 120 140';
  return (
    <Svg width={size * (category === 'Clothing' ? 1 : 0.86)} height={size} viewBox={vb}>
      {category === 'Snacks' && (<>
        <Path {...common} d="M28 24l5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6v86l-5 8H33l-5-8z" />
        <Path {...common} d="M28 38h64" /><Circle {...common} cx="60" cy="76" r="17" /><Path {...common} d="M52 76l6 6 11-12" />
      </>)}
      {category === 'Skincare' && (<>
        <Rect {...common} x="46" y="12" width="28" height="20" rx="4" /><Rect {...common} x="51" y="32" width="18" height="10" />
        <Rect {...common} x="34" y="42" width="52" height="88" rx="12" /><Rect {...common} x="43" y="72" width="34" height="32" rx="4" />
        <Path {...common} d="M49 84h22M49 92h14" />
      </>)}
      {category === 'Clothing' && <Path {...common} d="M50 20L24 36l10 22 12-6v70h48V52l12 6 10-22-26-16c-4 10-14 14-20 14s-16-4-20-14z" />}
      {category === 'Apps' && (<>
        <Rect {...common} x="22" y="30" width="76" height="76" rx="22" /><Circle {...common} cx="60" cy="68" r="18" /><Path {...common} d="M52 68l6 6 11-12" />
      </>)}
    </Svg>
  );
}

export function Art({ category, height = 170, radius = 18, style }: { category: Idea['category']; height?: number; radius?: number; style?: object }) {
  return (
    <LinearGradient colors={['#3a3a3c', '#0c0c0d']} style={[{ height, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <ArtGlyph category={category} size={height * 0.62} />
    </LinearGradient>
  );
}
export const Spacer = ({ h = 8, w = 0 }: { h?: number; w?: number }) => <View style={{ height: h, width: w }} />;
