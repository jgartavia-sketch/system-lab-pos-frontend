$ErrorActionPreference = "Stop"
$installDir = Join-Path $env:LOCALAPPDATA "SystemLab\PrintAgent"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Startup")) "System Lab Print Agent.lnk"

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*$installDir*server.js*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath -Force }
Write-Host "System Lab Print Agent fue detenido y retirado del inicio automático." -ForegroundColor Green
Write-Host "La configuración permanece en $installDir para evitar perderla accidentalmente." -ForegroundColor Gray
