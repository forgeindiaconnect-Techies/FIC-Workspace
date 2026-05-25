# Nexus Workspace — Mobile (Expo)

React Native app for Android/iOS. **Separate from the Vite web app** in the repo root.

## Run

From the `mobile` folder:

```bash
cd mobile
npm install
cp .env.example .env   # optional: set API URL
npm start
```

From the **repo root** (same thing):

```bash
npm run expo
# or: npx expo start mobile
```

Scan the QR code with **Expo Go** on your phone for the main workflow, or build a dev client / APK for **WebRTC video calls** (Expo Go does not include `react-native-webrtc`).

**Web in browser** (`http://localhost:8081`): requires `react-dom` (installed). After dependency changes, run `npx expo start -c`. Video meetings on web use the browser WebRTC APIs; native WebRTC modules are stubbed out for web builds.

## Build APK

```bash
cd mobile
eas build -p android --profile preview
```

## Backend

Uses `backend-fastify` at the repo root. Start it locally or point `EXPO_PUBLIC_API_URL` to Render.
