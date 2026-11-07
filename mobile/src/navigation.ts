import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootParams } from './types';
export type Nav = NativeStackNavigationProp<RootParams>;
export const useNav = () => useNavigation<Nav>();
