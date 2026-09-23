const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const APP_DIR = process.env.SYSTEMLAB_PRINT_AGENT_HOME
  ? path.resolve(process.env.SYSTEMLAB_PRINT_AGENT_HOME)
  : __dirname;
const CONFIG_PATH = path.join(APP_DIR, 'config.json');
const JOBS_PATH = path.join(APP_DIR, 'jobs.json');

const basePrinter = {
  type: 'windows', name: '', host: '', port: 9100,
  paperWidth: 80, charactersPerLine: 48,
  codePage: 'cp850', codePageId: 2,
  autoCut: true, feedLines: 5
};

const defaultStations = {
  receipt: { ...basePrinter, label: 'Comprobante del cliente' },
  kitchen: { ...basePrinter, label: 'Cocina' },
  bar: { ...basePrinter, label: 'Bar / bebidas' }
};

const defaultConfig = {
  port: 18181,
  apiKey: '',
  allowedOrigins: [
    'https://systemlabcr.com',
    'https://www.systemlabcr.com',
    'http://localhost:4200'
  ],
  stations: defaultStations,
  jobs: { deduplicationHours: 24, historyLimit: 500 }
};

function mergeConfig(input = {}) {
  const stations = {};
  const incoming = input.stations && typeof input.stations === 'object' ? input.stations : {};
  for (const [key, station] of Object.entries({ ...defaultStations, ...incoming })) {
    if (!/^[a-z][a-z0-9_-]{0,49}$/.test(key)) continue;
    stations[key] = {
      ...basePrinter,
      ...(defaultStations[key] || {}),
      ...(station || {}),
      label: String(station?.label || defaultStations[key]?.label || key).slice(0, 80)
    };
  }
  // Versiones 1.x guardaban una sola impresora. Se conserva como Cocina para
  // que una actualización no borre la configuración que ya está funcionando.
  if (input.printer && !input.stations) stations.kitchen = { ...stations.kitchen, ...input.printer };
  return {
    ...defaultConfig,
    ...input,
    stations,
    printer: stations.kitchen,
    jobs: { ...defaultConfig.jobs, ...(input.jobs || {}) }
  };
}

function loadConfig() {
  fs.mkdirSync(APP_DIR, { recursive: true });
  let config = defaultConfig;
  if (fs.existsSync(CONFIG_PATH)) {
    config = mergeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  } else {
    config = mergeConfig({ apiKey: crypto.randomBytes(24).toString('hex') });
    saveConfig(config);
  }
  if (!config.apiKey) {
    config.apiKey = crypto.randomBytes(24).toString('hex');
    saveConfig(config);
  }
  return config;
}

function saveConfig(input) {
  const config = mergeConfig(input);
  const temp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(temp, CONFIG_PATH);
  return config;
}

function loadJobs() {
  try { return JSON.parse(fs.readFileSync(JOBS_PATH, 'utf8')); }
  catch { return []; }
}

function saveJobs(jobs, limit) {
  fs.writeFileSync(JOBS_PATH, JSON.stringify(jobs.slice(-limit), null, 2), 'utf8');
}

function isPrinterConfigured(printer) {
  return printer?.type === 'network'
    ? Boolean(printer.host && Number(printer.port))
    : Boolean(printer?.name);
}

function publicPrinter(printer) {
  return printer?.type === 'network'
    ? { type: 'network', host: printer.host, port: Number(printer.port || 9100) }
    : { type: 'windows', name: printer?.name || '' };
}

function publicStations(stations = {}) {
  return Object.entries(stations).map(([key, station]) => ({
    key,
    label: station.label || key,
    configured: isPrinterConfigured(station),
    printer: publicPrinter(station)
  }));
}

function tempFile(jobId) {
  return path.join(os.tmpdir(), `system-lab-${jobId}.bin`);
}

module.exports = {
  APP_DIR, CONFIG_PATH, JOBS_PATH, defaultConfig, mergeConfig,
  loadConfig, saveConfig, loadJobs, saveJobs,
  isPrinterConfigured, publicPrinter, publicStations, tempFile
};
