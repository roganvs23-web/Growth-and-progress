import { useColorScheme } from 'react-native';

// Same palette as the clickable mockup and live prototype.
const light = {
  bg: '#F3F5F7', card: '#FFFFFF', line: '#E1E5EA', ink: '#12161C', muted: '#5B6470',
  accent: '#0F766E', accentInk: '#FFFFFF', accentSoft: '#E6F2F1', accentText: '#115E59',
  warm: '#FFF4EC', warmLine: '#F5D3BC', warmText: '#9A3412',
  hero: '#12161C', heroInk: '#FFFFFF', heroMuted: '#C9D0D8', ring: '#5EEAD4', ringTrack: '#2A313B',
  miss: '#DC2626',
};
const dark: typeof light = {
  bg: '#12161C', card: '#1B2027', line: '#2A313B', ink: '#EEF1F4', muted: '#A3ADB9',
  accent: '#2DD4BF', accentInk: '#06201D', accentSoft: '#123B37', accentText: '#99F6E4',
  warm: '#2B1D14', warmLine: '#5A3620', warmText: '#FDBA8C',
  hero: '#0B0E12', heroInk: '#FFFFFF', heroMuted: '#A3ADB9', ring: '#5EEAD4', ringTrack: '#2A313B',
  miss: '#F87171',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
