# Android phone testing (Windows)

## Expo Go over Wi-Fi

The project uses Expo SDK 57. If the installed Expo Go app reports SDK 58, it cannot load this project. Do not upgrade the project just to match that app. Expo Go must match the project SDK, and Expo Go does not include every native module used by Wrapchik.

1. Start the backend once. If port 5000 is already listening, reuse that process:

   ```powershell
   Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
   ```

   If the command returns no listener, open a terminal in the project and run:

   ```powershell
   Set-Location .\backend
   npm run dev
   ```

2. In a second terminal, start Expo with the LAN helper. It discovers the current laptop IPv4, sets `EXPO_PUBLIC_API_URL` for this Expo session, checks the backend, clears Metro's cache, and starts the Expo Go QR code:

   ```powershell
   Set-Location .\frontend
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-android-lan.ps1
   ```

3. Connect the phone and laptop to the same Wi-Fi, open Expo Go, and scan the QR code. In the phone browser, check `http://<laptop-Wi-Fi-IPv4>:5000/health`. The laptop address can change between networks; the helper detects it each time.

4. On the phone, tap email and password fields and type; scroll the login form with the keyboard open; sign in; browse the menu; add an item; change its quantity; and open checkout. If login opens but menu or checkout reports offline, verify the health URL from step 3 and the backend terminal. If Windows blocks the phone, ask an administrator to allow inbound backend traffic on port 5000 for the local network; this project does not change firewall settings.

## Installed APK

An APK keeps the API URL that was bundled with it. The EAS **preview** profile requires HTTPS, so it cannot target this laptop's local HTTP server. For an installed development client connected to the local backend, start Metro with the dynamic LAN helper:

```powershell
Set-Location .\frontend
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-android-lan.ps1 -DevClient
```

For a standalone preview APK, configure `EXPO_PUBLIC_API_URL` in the EAS **preview** environment to the deployed HTTPS backend. Then build/install the APK:

```powershell
Set-Location .\frontend
eas build --platform android --profile preview
```

## Recommended: Android development build (SDK 57)

Use this for native Google Sign-In and camera scanning. It keeps the current Expo SDK and dependency lockfile; no Expo upgrade is required.

1. From the repository root, create and install a development APK:

   ```powershell
   Set-Location .\frontend
   npx eas-cli build --platform android --profile development
   ```

   Open the completed EAS build link on the phone and install the APK. This is a development client, not a standalone store/preview APK.

2. Start the LAN backend/Metro session (reuse the backend already listening on port 5000):

   ```powershell
   Set-Location .\frontend
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-android-lan.ps1 -DevClient
   ```

3. Open the installed Wrapchik development build and connect it to the Metro server shown in the terminal. Keep both devices on the same Wi-Fi.

For a local build with Android Studio and a connected device, use `npx expo run:android` from `frontend`. Expo Go remains suitable for JavaScript-only checks only when its SDK matches; its missing native modules require manual pickup-code entry instead of camera scanning.

## If the phone cannot reach the laptop

First verify both devices use the same Wi-Fi and open the laptop's current `/health` URL on the phone. On Windows, confirm the backend and Metro listeners and the active network profile:

```powershell
Get-NetConnectionProfile
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 5000,8081 } | Format-Table LocalAddress,LocalPort,OwningProcess
```

If the laptop can open `http://127.0.0.1:5000/health` but the phone cannot open `http://<laptop-Wi-Fi-IPv4>:5000/health`, ask an administrator to run this narrowly scoped rule in elevated PowerShell. It allows Node.js on ports 5000 and 8081 only from the local subnet; it does not change the network profile or expose the ports to the internet.

```powershell
$nodePath = (Get-Command node.exe).Source
New-NetFirewallRule -DisplayName "Wrapchik LAN development (5000,8081)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5000,8081 -RemoteAddress LocalSubnet -Profile Any -Program $nodePath
```

To remove only this rule later:

```powershell
Remove-NetFirewallRule -DisplayName "Wrapchik LAN development (5000,8081)"
```

If the phone still cannot open `/health` after that rule is enabled, the access point may block communication between Wi-Fi clients (client isolation). No firewall change is made by the app or LAN startup script.
