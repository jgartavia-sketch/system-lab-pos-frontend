$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "SYSTEM LAB PRINT AGENT" -ForegroundColor Green
Write-Host "Instalación de estación de impresión" -ForegroundColor Gray
Write-Host ""

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw "Node.js 20 o superior no está instalado. Instalalo y ejecutá este archivo nuevamente."
}

$major = [int]((& $nodeCommand.Source --version).TrimStart("v").Split(".")[0])
if ($major -lt 20) {
  throw "Se requiere Node.js 20 o superior. Versión detectada: $(& $nodeCommand.Source --version)"
}

$source = Split-Path -Parent $PSScriptRoot
$installDir = Join-Path $env:LOCALAPPDATA "SystemLab\PrintAgent"
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "System Lab Print Agent.lnk"

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $installDir "public") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $installDir "scripts") -Force | Out-Null

$files = @("server.js", "lib.js", "escpos.js", "printer.js", "package.json", "config.example.json")
foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $installDir $file) -Force
}
Copy-Item -Path (Join-Path $source "public\*") -Destination (Join-Path $installDir "public") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $source "scripts\raw-print.ps1") -Destination (Join-Path $installDir "scripts\raw-print.ps1") -Force

$vbsPath = Join-Path $installDir "start-hidden.vbs"
$nodeEscaped = $nodeCommand.Source.Replace('"', '""')
$serverEscaped = (Join-Path $installDir "server.js").Replace('"', '""')
$vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.Run Chr(34) & "$nodeEscaped" & Chr(34) & " " & Chr(34) & "$serverEscaped" & Chr(34), 0, False
"@
Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding UTF8

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = '"' + $vbsPath + '"'
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = "System Lab Print Agent"
$shortcut.Save()

$existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*$installDir*server.js*" }
if (-not $existing) {
  Start-Process -FilePath "$env:WINDIR\System32\wscript.exe" -ArgumentList ('"' + $vbsPath + '"')
}

Start-Sleep -Seconds 2
Write-Host "Instalación completada." -ForegroundColor Green
Write-Host "El agente iniciará automáticamente con Windows." -ForegroundColor Gray
Write-Host "Abriendo el panel para elegir la impresora..." -ForegroundColor Gray
Start-Process "http://127.0.0.1:18181"
