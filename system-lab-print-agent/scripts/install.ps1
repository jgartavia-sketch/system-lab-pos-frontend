$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "SYSTEM LAB PRINT AGENT" -ForegroundColor Green
Write-Host "Instalación de estación de impresión" -ForegroundColor Gray
Write-Host ""

function Find-CompatibleNode {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $command) { return $null }
  try {
    $major = [int]((& $command.Source --version).TrimStart("v").Split(".")[0])
    if ($major -ge 20) { return $command.Source }
  } catch { return $null }
  return $null
}

$nodePath = Find-CompatibleNode
if (-not $nodePath) {
  Write-Host "Preparando el componente de ejecución..." -ForegroundColor Yellow
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    Start-Process "https://nodejs.org/en/download"
    throw "Windows no tiene disponible el instalador automático. Instalá Node.js LTS desde la página que se abrió y ejecutá nuevamente este archivo."
  }

  $arguments = @(
    "install", "--id", "OpenJS.NodeJS.LTS", "--exact", "--silent",
    "--accept-package-agreements", "--accept-source-agreements"
  )
  $installation = Start-Process -FilePath $winget.Source -ArgumentList $arguments -Wait -PassThru
  if ($installation.ExitCode -ne 0) {
    throw "Windows no pudo instalar automáticamente el componente requerido. Código: $($installation.ExitCode)."
  }

  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  $nodePath = Find-CompatibleNode
  if (-not $nodePath) {
    throw "El componente se instaló, pero Windows todavía no lo detecta. Reiniciá la computadora y ejecutá nuevamente el instalador."
  }
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
$nodeEscaped = $nodePath.Replace('"', '""')
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
