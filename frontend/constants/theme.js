import { Platform } from 'react-native';

const theme = {
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40 },
  radius: { xs: 6, sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  type: {
    display: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
    section: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
    label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
    // New premium variants
    hero: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
    sectionLabel: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2 },
    price: { fontSize: 16, lineHeight: 22, fontWeight: '900' },
    priceSmall: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
    badge: { fontSize: 10, lineHeight: 14, fontWeight: '800' },
    metric: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
    metricLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  },
  layout: { pageMaxWidth: 1080, contentMaxWidth: 720, pageGutter: 20, touchTarget: 48 },

  // Shadow presets
  shadow: {
    sm: Platform.select({
      ios: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
      default: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
    }),
    md: Platform.select({
      ios: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 3 },
      default: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
    }),
    lg: Platform.select({
      ios: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 6 },
      default: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    }),
    card: Platform.select({
      ios: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      default: { shadowColor: '#1F2937', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    }),
    float: Platform.select({
      ios: { shadowColor: '#45251B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 10 },
      android: { elevation: 8 },
      default: { shadowColor: '#45251B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 10 },
    }),
  },

  // Animation timing
  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
};

export default theme;
