export default function appConfig({ config }) {
  return {
    ...config,
    expo: {
      name: "Admin Savitara",
      slug: "admin-savitara-app",
      version: "1.0.0",
      orientation: "portrait",
      userInterfaceStyle: "light",
      splash: {
        resizeMode: "contain",
        backgroundColor: "#FF6B35"
      },
      assetBundlePatterns: ["**/*"],
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.savitara.admin"
      },
      android: {
        adaptiveIcon: {
          backgroundColor: "#FF6B35"
        },
        package: "com.savitara.admin"
      },
      extra: {
        apiUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1',
        googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
      }
    }
  };
}
