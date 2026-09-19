const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { tempFile } = require('./lib');

function powershell(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Windows tardó demasiado en responder a la impresora.'));
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error((stderr || stdout || `PowerShell terminó con código ${code}`).trim()));
    });
  });
}

async function listWindowsPrinters() {
  if (process.platform !== 'win32') return [];
  const script = [
    "$items = Get-CimInstance Win32_Printer | Select-Object Name,DriverName,PortName,PrinterStatus,Default,WorkOffline",
    "$items | ConvertTo-Json -Compress"
  ].join('; ');
  const raw = await powershell(['-Command', script]);
  if (!raw) return [];
  const result = JSON.parse(raw);
  return (Array.isArray(result) ? result : [result]).map(item => ({
    name: item.Name,
    driver: item.DriverName,
    port: item.PortName,
    default: Boolean(item.Default),
    offline: Boolean(item.WorkOffline),
    status: item.PrinterStatus
  }));
}

function printNetwork(buffer, printer) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: printer.host, port: Number(printer.port || 9100) });
    socket.setTimeout(10000);
    socket.once('connect', () => socket.end(buffer));
    socket.once('timeout', () => socket.destroy(new Error('La impresora de red no respondió.')));
    socket.once('error', reject);
    socket.once('close', hadError => { if (!hadError) resolve(); });
  });
}

async function printWindows(buffer, printer, jobId) {
  if (process.platform !== 'win32') throw new Error('La impresión por cola de Windows solo está disponible en Windows.');
  const file = tempFile(jobId);
  fs.writeFileSync(file, buffer);
  try {
    await powershell([
      '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname, 'scripts', 'raw-print.ps1'),
      '-PrinterName', printer.name,
      '-FilePath', file,
      '-DocumentName', `System Lab Comanda ${jobId}`
    ], 20000);
  } finally {
    try { fs.unlinkSync(file); } catch { /* limpieza no crítica */ }
  }
}

async function printRaw(buffer, printer, jobId) {
  if (printer.type === 'network') return printNetwork(buffer, printer);
  return printWindows(buffer, printer, jobId);
}

module.exports = { listWindowsPrinters, printRaw };
