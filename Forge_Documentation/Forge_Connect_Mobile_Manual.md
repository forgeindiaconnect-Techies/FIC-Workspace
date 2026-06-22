---
title: Forge India Workspace - Mobile Application Documentation
author: Forge Connect Inc.
date: 2026-06-19
---

# Forge India Workspace - Mobile Application Documentation

Welcome to the comprehensive technical and operational guide for the **Forge India Workspace Mobile Application**. This document outlines the mobile architecture, core application features, technologies utilized, and user workflows designed for team collaboration on the go.

The mobile application acts as the portable counterpart to the web workspace, specializing in high-fidelity Unified Communications (Video Conferencing and Chat) while maintaining strict enterprise security.

---

## 💻 Technologies Used
The Forge India Workspace Mobile Application is engineered for cross-platform performance using modern frameworks:
- **Core Framework**: React Native & Expo SDK (Cross-platform iOS and Android).
- **Styling**: Tailwind CSS (via `twrnc` for native compilation) allowing consistent design language with the web application.
- **Real-Time Communication**: `react-native-webrtc` (Video/Audio streams), Socket.io-client (Signaling and Chat).
- **Hardware Integrations**: `expo-av` (Audio session and speaker routing), `expo-camera` (Device cameras).
- **Backend**: Integrates with the central Node.js/Fastify server and MongoDB infrastructure.

---

## 1. Meetings (Video Conferencing)
The core offering of the mobile application is the highly optimized WebRTC Meetings experience.

### Deep Dive: Core Functions & Capabilities
- **Native WebRTC Integration**: Leverages low-level WebRTC bindings for hardware-accelerated video decoding and low-latency audio transmission over mobile networks.
- **Adaptive UI & Scrollable Grids**: The mobile interface utilizes flexible `ScrollView` components to gracefully handle large participant counts (gallery view) without freezing or overflowing smaller screens.
- **Advanced Audio Management**: Background audio and interruption handling are strictly controlled using Expo AV to ensure call audio persists cleanly, even if the device screen locks.
- **Host Controls**: Full suite of moderation features accessible directly from the mobile app. Hosts can mute all participants, lock rooms, admit guests from a waiting room, and transfer presenter privileges.
- **Local Screen Sharing**: Native screen capturing allowing mobile users to broadcast their entire phone screen to the meeting room.

### End-to-End User Workflow
1. **Joining a Call**: Users open the app and paste a secure Room ID (or tap a deep link) to immediately enter the meeting lobby.
2. **In-Call Engagement**: Inside the meeting, users can toggle their camera and microphone, flip between front and back-facing cameras, and view the active speaker dynamically highlighted.
3. **Navigating Participants**: Users can swipe through the vertical grid of participant tiles or pin a specific user (such as a presenter) to maximize their video feed on the screen.
4. **Moderation (As Host)**: A host taps the "Host Controls" tab to enforce room lock, preventing unauthorized attendees from joining late.

---

## 2. Real-Time Chat & Communications
The mobile app also provides a robust interface for synchronous messaging to ensure teams stay connected away from their desks.

### Deep Dive: Core Functions & Capabilities
- **Instant Messaging**: Seamless integration with the web platform's chat infrastructure. Direct Messages (DMs) and Channel messages sync instantly via WebSockets.
- **Presence Indicators**: Users can view the online/offline status of colleagues directly from the mobile directory.
- **Push Notifications**: Real-time push alerts for `@mentions` and direct messages ensure critical communications are never missed.

### End-to-End User Workflow
1. **Triaging Messages**: The user opens the Chat tab to view a chronologically sorted list of recent conversations, with bold indicators for unread threads.
2. **Responding**: The user taps a thread, reads the history, and uses the native keyboard to quickly send a response, complete with emoji support.

---

## 3. Mail, Docs, Sheets & Show
To ensure full feature parity with the web platform, the mobile application provides dedicated tabs for accessing the core workspace productivity apps.

### Deep Dive: Core Functions & Capabilities
- **Web-to-Mobile Continuity**: The Mail, Docs, Sheets, and Show applications are integrated into the mobile shell via responsive, touch-friendly interfaces, providing a seamless transition from desktop to mobile.
- **Mail App**: View your inbox, read secure enterprise emails, and compose messages on the go with responsive reading panes.
- **Docs & Sheets App**: View and collaboratively edit Rich-Text documents and Data Grids in real-time. The UI adapts to touch controls for selecting cells and formatting text.
- **Show App**: Review presentations and slide decks directly from your mobile device before heading into a meeting.
- **Unified Navigation**: Users can seamlessly tab between active meetings, chat channels, and their documents without losing state.

### End-to-End User Workflow
1. **Quick Document Review**: While commuting, a user taps the "Docs" tab, navigates to the "Q3 Campaign" folder, and reviews the latest changes made by their team.
2. **Checking Spreadsheets**: The user opens the "Sheets" tab to quickly verify a financial figure in the active workspace spreadsheet, ensuring they have the correct data before an ad-hoc video call.
3. **Reading Mail**: The user triages new messages from the "Mail" tab, marking important items for follow-up later on their desktop.

---

## 4. Testing & Deployment (EAS)
The application leverages Expo Application Services (EAS) for streamlined building and over-the-air updates.

- **Development**: Local testing is done via Metro bundler (`npm start`). However, due to native WebRTC dependencies, an Expo Dev Client or standalone APK must be compiled for testing camera/audio features instead of standard Expo Go.
- **Building for Production**: Executing `eas build -p android --profile preview` generates a standalone Android APK.
- **Over-The-Air (OTA) Updates**: For pure JavaScript/TypeScript logic updates (such as UI tweaks or layout fixes), the mobile app downloads updates seamlessly without requiring users to reinstall an APK.
