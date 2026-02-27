export default function appConfig({ config }) {
  return {
    ...config,
    expo: {
      name: "Savitara",
      slug: "savitara",
      version: "1.0.0",
      scheme: "savitara",
      orientation: "portrait",
      userInterfaceStyle: "light",
      splash: {
        resizeMode: "contain",
        backgroundColor: "#FF6B35"
      },
      assetBundlePatterns: [
        "**/*"
      ],
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.savitara.app"
      },
      android: {
        adaptiveIcon: {
          backgroundColor: "#FF6B35"
        },
        package: "com.savitara.app"
      },
      plugins: [
        [
          "expo-notifications",
          {
            "color": "#FF6B35"
          }
        ]
      ],
      extra: {
        apiUrl: process.env.EXPO_PUBLIC_API_BASE_URL || (__DEV__ ? 'http://localhost:8000/api/v1' : (() => { throw new Error('EXPO_PUBLIC_API_BASE_URL must be set for production builds'); })()),
        googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
        razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '',
        eas: {
          projectId: "savitara-app"
        }
      }
    }
  };
}
