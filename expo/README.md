# AXAS Driver — Expo Go

This is the Expo Go-compatible React Native app source. It is kept in the `expo/` folder so the existing Android project and server remain untouched.

## Run on Android

1. Install Node.js on a computer or use a compatible cloud development environment.
2. From this folder run:
   `npm install`
3. Align Expo package versions:
   `npx expo install --fix`
4. Start the development server:
   `npx expo start --tunnel`
5. Open Expo Go and scan the QR code.

The app currently includes the Vanadzor map, foreground GPS permission, online/offline toggle, and driver summary UI. API/server connection and live order dispatch are not connected yet.
