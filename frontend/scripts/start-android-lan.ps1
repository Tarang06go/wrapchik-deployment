param([switch]$DevClient)

$ErrorActionPreference = 'Stop'

$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $frontendRoot

$networks = @(Get-NetIPConfiguration |
  Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.NetAdapter.HardwareInterface -and $_.IPv4DefaultGateway -and $_.IPv4Address })
$network = $networks |
  Where-Object { $_.NetAdapter.InterfaceAlias -match 'Wi-?Fi|Wireless|Ethernet' } |
  Select-Object -First 1
if (-not $network) { $network = $networks | Select-Object -First 1 }
$lanIp = $network.IPv4Address |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $lanIp) {
  throw 'Could not find an active LAN IPv4 address. Connect this laptop to Wi-Fi or Ethernet and run the script again.'
}

$apiOrigin = "http://${lanIp}:5000"
$env:EXPO_PUBLIC_API_URL = $apiOrigin
Write-Host "Using network adapter: $($network.NetAdapter.InterfaceAlias)" -ForegroundColor DarkGray
Write-Host "Wrapchik API for this Expo session: $apiOrigin/api" -ForegroundColor Cyan

try {
  $health = Invoke-RestMethod -Uri "$apiOrigin/" -TimeoutSec 3
  if ($health.status -eq 'ACTIVE') {
    Write-Host 'Backend health check passed.' -ForegroundColor Green
  } else {
    Write-Warning 'The backend answered but did not report ACTIVE. Expo will still start so you can open login/signup screens.'
  }
} catch {
  Write-Warning "Backend health check failed at $apiOrigin/. Expo will still start; API actions will need the backend to be available."
  Write-Warning 'Start backend/src/scripts/devServer.js in the backend folder, then retry the health check from the phone.'
}

if ($DevClient) {
  npx expo start --dev-client --host lan --clear
} else {
  npx expo start --host lan --clear
}
