<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/187a5a73-4306-4810-afa4-106f81bd68e6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Expo Go + local Fastify backend

When testing on a physical phone, the phone cannot reach `localhost` on your computer. Start the backend from `backend-fastify` and make sure the phone and computer are on the same Wi-Fi network:

1. Run the backend:
   `cd backend-fastify && npm run dev`
2. Run Expo:
   `npm run expo`
3. If login still cannot reach the backend, create `.env` in the project root and set:
   `EXPO_PUBLIC_API_URL="http://YOUR_COMPUTER_LAN_IP:3001"`
