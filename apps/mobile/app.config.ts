import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'SplitSmart',
  slug: 'splitsmart',
  scheme: 'splitsmart',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: { supportsTablet: true, bundleIdentifier: 'com.splitsmart.app' },
  android: { package: 'com.splitsmart.app' },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
};

export default config;
