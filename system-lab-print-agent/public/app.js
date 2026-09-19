const $ = id => document.getElementById(id);
let config;

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

function toggleFields() {
  const network = $('printer-type').value === 'network';
  $('windows-field').style.display = network ? 'none' : 'grid';
  document.querySelectorAll('.network-field').forEach(field => { field.style.display = network ? 'grid' : 'none'; });
}

async function loadPrinters() {
  const select = $('printer-name');
  select.innerHTML = '<option value="">Buscando impresoras…</option>';
  try {
    const { printers } = await api('/v1/printers');
    select.innerHTML = '<option value="">Seleccionar impresora</option>';
    for (const printer of printers) {
      const option = document.createElement('option');
      option.value = printer.name;
      option.textContent = `${printer.name}${printer.default ? ' · Predeterminada' : ''}${printer.offline ? ' · Sin conexión' : ''}`;
      select.appendChild(option);
    }
    if (config?.printer?.name) select.value = config.printer.name;
  } catch (error) {
    select.innerHTML = '<option value="">No se pudieron consultar</option>';
    message(error.message, true);
  }
}

async function loadJobs() {
  const { jobs } = await api('/v1/jobs');
  if (!jobs.length) return;
  $('jobs').innerHTML = '';
  for (const job of jobs) {
    const row = document.createElement('div');
    row.className = 'job';
    const info = document.createElement('span');
    info.textContent = `Pedido ${job.orderId} · ${new Date(job.createdAt).toLocaleString('es-CR')}`;
    const status = document.createElement('small');
    status.textContent = ({ printed: 'Impreso', failed: `Error: ${job.error || ''}`, queued: 'En cola', printing: 'Imprimiendo' })[job.status] || job.status;
    row.append(info, status);
    $('jobs').appendChild(row);
  }
}

async function load() {
  config = await api('/v1/config');
  $('printer-type').value = config.printer.type;
  $('printer-host').value = config.printer.host || '';
  $('printer-port').value = config.printer.port || 9100;
  $('paper-width').value = String(config.printer.paperWidth || 80);
  $('characters').value = config.printer.charactersPerLine || 48;
  $('code-page').value = config.printer.codePage || 'cp850';
  $('feed-lines').value = config.printer.feedLines || 5;
  $('auto-cut').value = String(config.printer.autoCut !== false);
  $('api-key').value = config.apiKey;
  $('origins').value = (config.allowedOrigins || []).join('\n');
  toggleFields();
  await Promise.all([loadPrinters(), loadJobs()]);
}

$('printer-type').addEventListener('change', toggleFields);
$('paper-width').addEventListener('change', () => { $('characters').value = $('paper-width').value === '58' ? 32 : 48; });
$('reload-printers').addEventListener('click', loadPrinters);
$('save').addEventListener('click', async () => {
  $('save').disabled = true;
  try {
    const paperWidth = Number($('paper-width').value);
    await api('/v1/config', {
      method: 'PUT',
      body: JSON.stringify({
        allowedOrigins: $('origins').value.split(/\r?\n/).map(value => value.trim().replace(/\/$/, '')).filter(Boolean),
        printer: {
          type: $('printer-type').value,
          name: $('printer-name').value,
          host: $('printer-host').value.trim(),
          port: Number($('printer-port').value),
          paperWidth,
          charactersPerLine: Number($('characters').value),
          codePage: $('code-page').value,
          codePageId: 2,
          feedLines: Number($('feed-lines').value),
          autoCut: $('auto-cut').value === 'true'
        }
      })
    });
    message('Configuración guardada. La estación está lista para la prueba.');
    config = await api('/v1/config');
  } catch (error) { message(error.message, true); }
  finally { $('save').disabled = false; }
});
$('test').addEventListener('click', async () => {
  $('test').disabled = true;
  try { await api('/v1/print/test', { method: 'POST', body: '{}' }); message('Prueba enviada correctamente a la impresora.'); await loadJobs(); }
  catch (error) { message(error.message, true); }
  finally { $('test').disabled = false; }
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
