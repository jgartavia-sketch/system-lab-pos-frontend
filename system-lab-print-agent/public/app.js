const $ = id => document.getElementById(id);
const protectedStations = new Set(['receipt', 'kitchen', 'bar']);
let config;
let windowsPrinters = [];
const removedStations = new Set();

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
  return result;
}

function message(text, error = false) {
  $('message').textContent = text;
  $('message').className = `message show${error ? ' error' : ''}`;
}

function stationSlug(label) {
  return String(label || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function printerOptions(select, selected) {
  select.innerHTML = '<option value="">Seleccionar impresora</option>';
  for (const printer of windowsPrinters) {
    const option = document.createElement('option');
    option.value = printer.name;
    option.textContent = `${printer.name}${printer.default ? ' · Predeterminada' : ''}${printer.offline ? ' · Sin conexión' : ''}`;
    select.appendChild(option);
  }
  select.value = selected || '';
}

function toggleCard(card) {
  const network = card.querySelector('.printer-type').value === 'network';
  card.querySelector('.windows-field').style.display = network ? 'none' : 'grid';
  card.querySelectorAll('.network-field').forEach(field => { field.style.display = network ? 'grid' : 'none'; });
}

function renderStation(key, station) {
  const fragment = $('station-template').content.cloneNode(true);
  const card = fragment.querySelector('.station-card');
  card.dataset.station = key;
  card.querySelector('.station-title').textContent = station.label || key;
  card.querySelector('.station-key').textContent = `Destino interno: ${key}`;
  card.querySelector('.station-label').value = station.label || key;
  card.querySelector('.printer-type').value = station.type || 'windows';
  printerOptions(card.querySelector('.printer-name'), station.name);
  card.querySelector('.printer-host').value = station.host || '';
  card.querySelector('.printer-port').value = station.port || 9100;
  card.querySelector('.paper-width').value = String(station.paperWidth || 80);
  card.querySelector('.characters').value = station.charactersPerLine || 48;
  card.querySelector('.code-page').value = station.codePage || 'cp850';
  card.querySelector('.feed-lines').value = station.feedLines || 5;
  card.querySelector('.auto-cut').value = String(station.autoCut !== false);
  card.querySelector('.remove-station').hidden = protectedStations.has(key);
  card.querySelector('.printer-type').addEventListener('change', () => toggleCard(card));
  card.querySelector('.paper-width').addEventListener('change', event => {
    card.querySelector('.characters').value = event.target.value === '58' ? 32 : 48;
  });
  card.querySelector('.station-label').addEventListener('input', event => {
    card.querySelector('.station-title').textContent = event.target.value || key;
  });
  card.querySelector('.remove-station').addEventListener('click', () => {
    if (!confirm(`¿Eliminar la estación ${station.label || key}?`)) return;
    removedStations.add(key);
    card.remove();
  });
  card.querySelector('.test-station').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await save(false);
      await api('/v1/print/test', { method: 'POST', body: JSON.stringify({ station: key }) });
      message(`Prueba enviada a ${card.querySelector('.station-label').value || key}.`);
      await loadJobs();
    } catch (error) { message(error.message, true); }
    finally { button.disabled = false; }
  });
  toggleCard(card);
  $('stations').appendChild(fragment);
}

function renderStations() {
  $('stations').innerHTML = '';
  for (const [key, station] of Object.entries(config.stations || {})) renderStation(key, station);
}

function readStations() {
  const stations = {};
  for (const card of document.querySelectorAll('.station-card')) {
    const key = card.dataset.station;
    const paperWidth = Number(card.querySelector('.paper-width').value);
    stations[key] = {
      label: card.querySelector('.station-label').value.trim() || key,
      type: card.querySelector('.printer-type').value,
      name: card.querySelector('.printer-name').value,
      host: card.querySelector('.printer-host').value.trim(),
      port: Number(card.querySelector('.printer-port').value),
      paperWidth,
      charactersPerLine: Number(card.querySelector('.characters').value),
      codePage: card.querySelector('.code-page').value,
      codePageId: 2,
      feedLines: Number(card.querySelector('.feed-lines').value),
      autoCut: card.querySelector('.auto-cut').value === 'true'
    };
  }
  return stations;
}

async function save(showMessage = true) {
  const result = await api('/v1/config', {
    method: 'PUT',
    body: JSON.stringify({
      allowedOrigins: $('origins').value.split(/\r?\n/).map(value => value.trim().replace(/\/$/, '')).filter(Boolean),
      stations: readStations(),
      removedStations: [...removedStations]
    })
  });
  config = await api('/v1/config');
  removedStations.clear();
  if (showMessage) message(`Configuración guardada. ${result.stations.filter(item => item.configured).length} ruta(s) listas.`);
}

async function loadPrinters() {
  try {
    const result = await api('/v1/printers');
    windowsPrinters = result.printers || [];
    for (const card of document.querySelectorAll('.station-card')) {
      const selected = card.querySelector('.printer-name').value;
      printerOptions(card.querySelector('.printer-name'), selected);
    }
  } catch (error) { message(error.message, true); }
}

async function loadJobs() {
  const { jobs } = await api('/v1/jobs');
  if (!jobs.length) return;
  $('jobs').innerHTML = '';
  for (const job of jobs) {
    const row = document.createElement('div');
    row.className = 'job';
    const info = document.createElement('span');
    const kind = job.kind === 'receipt' ? 'Comprobante' : job.kind === 'test' ? 'Prueba' : 'Comanda';
    info.textContent = `${kind} ${job.orderId} · ${job.stationLabel || job.station || 'Cocina'} · ${new Date(job.createdAt).toLocaleString('es-CR')}`;
    const status = document.createElement('small');
    status.textContent = ({ printed: 'Impreso', failed: `Error: ${job.error || ''}`, queued: 'En cola', printing: 'Imprimiendo' })[job.status] || job.status;
    row.append(info, status);
    $('jobs').appendChild(row);
  }
}

async function load() {
  config = await api('/v1/config');
  $('api-key').value = config.apiKey;
  $('origins').value = (config.allowedOrigins || []).join('\n');
  await loadPrinters();
  renderStations();
  await loadJobs();
}

$('reload-printers').addEventListener('click', loadPrinters);
$('save').addEventListener('click', async () => {
  $('save').disabled = true;
  try { await save(); }
  catch (error) { message(error.message, true); }
  finally { $('save').disabled = false; }
});
$('add-station').addEventListener('click', () => {
  const label = $('new-station-label').value.trim();
  const key = stationSlug(label);
  if (!key) return message('Escribí el nombre de la nueva estación.', true);
  if (document.querySelector(`[data-station="${key}"]`)) return message('Ya existe una estación con ese nombre.', true);
  removedStations.delete(key);
  renderStation(key, { label, type: 'windows', name: '', host: '', port: 9100, paperWidth: 80, charactersPerLine: 48, codePage: 'cp850', codePageId: 2, feedLines: 5, autoCut: true });
  $('new-station-label').value = '';
  message(`Estación ${label} agregada. Elegí su impresora y guardá todas las rutas.`);
});
$('show-key').addEventListener('click', async () => {
  $('api-key').type = 'text';
  $('api-key').select();
  try { await navigator.clipboard.writeText($('api-key').value); $('show-key').textContent = 'Clave copiada'; }
  catch { $('show-key').textContent = 'Clave visible'; }
});
$('regenerate-key').addEventListener('click', async () => {
  if (!confirm('La clave anterior dejará de funcionar. ¿Generar una nueva?')) return;
  const result = await api('/v1/regenerate-key', { method: 'POST', body: '{}' });
  $('api-key').value = result.apiKey;
  $('api-key').type = 'password';
  $('show-key').textContent = 'Mostrar y copiar';
  message('Clave renovada. Copiala nuevamente en el POS.');
});

load().catch(error => message(error.message, true));
