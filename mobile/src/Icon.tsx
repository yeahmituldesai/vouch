import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const P: Record<string, (c: string) => React.ReactNode> = {
  home: () => <Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  search: () => (<><Circle cx="11" cy="11" r="6.5" /><Path d="M20 20l-4.2-4.2" /></>),
  plus: () => <Path d="M12 5v14M5 12h14" />,
  bell: () => (<><Path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15z" /><Path d="M10 21h4" /></>),
  user: () => (<><Circle cx="12" cy="8" r="4" /><Path d="M4.5 21c0-4 3.5-6 7.5-6s7.5 2 7.5 6" /></>),
  back: () => <Path d="M15 5l-7 7 7 7" />,
  fwd: () => <Path d="M9 5l7 7-7 7" />,
  vouch: () => (<><Circle cx="12" cy="12" r="9" /><Path d="M8 12.5l3 3 5-6" /></>),
  chat: () => <Path d="M4 5h16v11H9l-5 4z" />,
  bag: () => (<><Path d="M6 8h12l1 12H5z" /><Path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>),
  x: () => <Path d="M6 6l12 12M18 6L6 18" />,
  check: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: () => (<><Rect x="5" y="11" width="14" height="9" rx="2.5" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  share: () => <Path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7" />,
  more: () => (<><Circle cx="6" cy="12" r="1" /><Circle cx="12" cy="12" r="1" /><Circle cx="18" cy="12" r="1" /></>),
  settings: () => (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  users: () => (<><Circle cx="9" cy="9" r="3.2" /><Path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /></>),
  up: () => <Path d="M12 19V5M6 11l6-6 6 6" />,
  down: () => <Path d="M12 5v14M19 12l-7 7-7-7" />,
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 22, color = '#fff', w = 1.9 }: { name: IconName; size?: number; color?: string; w?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {P[name](color)}
    </Svg>
  );
}
