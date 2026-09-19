const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderComanda } = require('./escpos');
const { listWindowsPrinters, printRaw } = require('./printer');
const {
  loadConfig, saveConfig, loadJobs, saveJobs,
  isPrinterConfigured, publicPrinter
} = require('./lib');

const VERSION = '1.0.0';
let config = loadConfig();
let jobs = loadJobs();
let queue = Promise.resolve();

function json(response, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  response.end(body);
}

function originAllowed(origin) {
  if (!origin) return true;
  return config.allowedOrigins.includes(origin);
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  if (!origin || !originAllowed(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-System-Lab-Key',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600'
  };
}

function isLocalPanel(request) {
  const origin = request.headers.origin || '';
  return !origin || origin === `http://127.0.0.1:${config.port}` || origin === `http://localhost:${config.port}`;
}

function authorized(request) {
  const supplied = String(request.headers['x-system-lab-key'] || '');
  if (!supplied || supplied.length !== config.apiKey.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(config.apiKey));
}

function readBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('La solicitud supera el tamaño permitido.'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('El cuerpo JSON no es válido.'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}

function validatePrintPayload(payload) {
  if (!payload?.idempotencyKey || typeof payload.idempotencyKey !== 'string') throw Object.assign(new Error('Falta la clave única del trabajo.'), { status: 400 });
  if (!payload?.order?.id) throw Object.assign(new Error('Falta el número de pedido.'), { status: 400 });
  if (!Array.isArray(payload.order.items) || !payload.order.items.length) throw Object.assign(new Error('La comanda no contiene productos.'), { status: 400 });
  if (payload.order.items.length > 200) throw Object.assign(new Error('La comanda supera 200 líneas.'), { status: 400 });
}

function findSuccessfulDuplicate(key) {
  const cutoff = Date.now() - Number(config.jobs.deduplicationHours || 24) * 3600000;
  return jobs.find(job => job.key === key && job.status === 'printed' && new Date(job.createdAt).getTime() >= cutoff);
}

function recordJob(job) {
  jobs.push(job);
  saveJobs(jobs, Number(config.jobs.historyLimit || 500));
}

function updateJob(id, patch) {
  const index = jobs.findIndex(job => job.id === id);
  if (index >= 0) jobs[index] = { ...jobs[index], ...patch };
  saveJobs(jobs, Number(config.jobs.historyLimit || 500));
}

function enqueuePrint(payload) {
  const jobId = crypto.randomUUID();
  recordJob({ id: jobId, key: payload.idempotencyKey, status: 'queued', createdAt: new Date().toISOString(), orderId: payload.order.id });
  const operation = queue.then(async () => {
    updateJob(jobId, { status: 'printing', startedAt: new Date().toISOString() });
    const bytes = renderComanda(payload, config.printer);
    await printRaw(bytes, config.printer, jobId);
    updateJob(jobId, { status: 'printed', completedAt: new Date().toISOString(), bytes: bytes.length });
    return { jobId, printed: true };
  }).catch(error => {
    updateJob(jobId, { status: 'failed', completedAt: new Date().toISOString(), error: error.message });
    throw error;
  });
  queue = operation.catch(() => undefined);
  return operation;
}

function servePanel(response) {
  const file = path.join(__dirname, 'public', 'index.html');
  const html = fs.readFileSync(file);
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': html.length,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"
  });
  response.end(html);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${config.port}`);
  const cors = corsHeaders(request);
  try {
    if (request.method === 'OPTIONS') {
      if (!originAllowed(request.headers.origin)) return json(response, 403, { error: 'Origen no autorizado.' });
      response.writeHead(204, cors); response.end(); return;
    }
    if (request.method === 'GET' && url.pathname === '/') return servePanel(response);
    if (request.method === 'GET' && url.pathname === '/app.js') {
      const file = fs.readFileSync(path.join(__dirname, 'public', 'app.js'));
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Content-Length': file.length, 'Cache-Control': 'no-store' });
      response.end(file); return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/health') {
      return json(response, 200, {
        ok: true, version: VERSION,
        printerConfigured: isPrinterConfigured(config.printer),
        printer: publicPrinter(config.printer)
      }, cors);
    }
    if (!isLocalPanel(request) && !originAllowed(request.headers.origin)) return json(response, 403, { error: 'Origen no autorizado.' }, cors);
    if (request.method === 'GET' && url.pathname === '/v1/config' && isLocalPanel(request)) {
      return json(response, 200, { ...config, apiKey: config.apiKey }, cors);
    }
    if (request.method === 'GET' && url.pathname === '/v1/printers' && isLocalPanel(request)) {
      return json(response, 200, { printers: await listWindowsPrinters() }, cors);
    }
    if (request.method === 'PUT' && url.pathname === '/v1/config' && isLocalPanel(request)) {
      const input = await readBody(request);
      const paperWidth = Number(input.printer?.paperWidth) === 58 ? 58 : 80;
      config = saveConfig({
        ...config,
        allowedOrigins: Array.isArray(input.allowedOrigins) ? input.allowedOrigins.map(String).filter(Boolean) : config.allowedOrigins,
        printer: {
          ...config.printer,
          ...(input.printer || {}),
          port: Number(input.printer?.port || 9100),
          paperWidth,
          charactersPerLine: Number(input.printer?.charactersPerLine || (paperWidth === 58 ? 32 : 48)),
          feedLines: Number(input.printer?.feedLines || 5),
          autoCut: input.printer?.autoCut !== false
        }
      });
      return json(response, 200, { ok: true, printerConfigured: isPrinterConfigured(config.printer) }, cors);
    }
    if (request.method === 'POST' && url.pathname === '/v1/regenerate-key' && isLocalPanel(request)) {
      config.apiKey = crypto.randomBytes(24).toString('hex');
      config = saveConfig(config);
      return json(response, 200, { ok: true, apiKey: config.apiKey }, cors);
    }
    if (request.method === 'POST' && url.pathname === '/v1/print/test' && isLocalPanel(request)) {
      if (!isPrinterConfigured(config.printer)) return json(response, 409, { error: 'Elegí y guardá una impresora primero.' }, cors);
      const id = Date.now();
      const result = await enqueuePrint({
        idempotencyKey: `test:${id}`,
        business: { name: 'SYSTEM LAB POS' },
        order: { id: 'PRUEBA', label: 'Estación configurada', createdAt: new Date().toISOString(), fulfillment: 'dine_in', items: [{ quantity: 1, name: 'Impresión ESC/POS correcta' }], notes: 'Si este texto se ve nítido, la estación está lista.' }
      });
      return json(response, 200, result, cors);
    }
    if (request.method === 'POST' && url.pathname === '/v1/print/comanda') {
      if (!authorized(request)) return json(response, 401, { error: 'La clave del agente no coincide. Volvé a vincular esta estación.' }, cors);
      if (!isPrinterConfigured(config.printer)) return json(response, 409, { error: 'El agente está activo, pero no tiene impresora configurada.' }, cors);
      const payload = await readBody(request);
      validatePrintPayload(payload);
      const duplicate = findSuccessfulDuplicate(payload.idempotencyKey);
      if (duplicate) return json(response, 200, { jobId: duplicate.id, duplicate: true, printed: true }, cors);
      const result = await enqueuePrint(payload);
      return json(response, 200, result, cors);
    }
    if (request.method === 'GET' && url.pathname === '/v1/jobs' && isLocalPanel(request)) {
      return json(response, 200, { jobs: jobs.slice(-30).reverse() }, cors);
    }
    return json(response, 404, { error: 'Ruta no encontrada.' }, cors);
  } catch (error) {
    console.error(new Date().toISOString(), error);
    if (!response.headersSent) json(response, error.status || 500, { error: error.message || 'Error interno del agente.' }, cors);
    else response.end();
  }
});

server.listen(Number(config.port || 18181), '127.0.0.1', () => {
  console.log(`System Lab Print Agent ${VERSION}`);
  console.log(`Panel: http://127.0.0.1:${config.port}`);
});

process.on('uncaughtException', error => console.error(new Date().toISOString(), error));
process.on('unhandledRejection', error => console.error(new Date().toISOString(), error));
