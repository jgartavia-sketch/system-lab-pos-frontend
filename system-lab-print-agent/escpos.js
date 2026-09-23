const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´≡±‗¾¶§÷¸°¨·¹³²■ ';

function encodeCp850(value) {
  const bytes = [];
  for (const original of String(value ?? '').normalize('NFC')) {
    const code = original.codePointAt(0);
    if (code <= 0x7f) { bytes.push(code); continue; }
    const index = CP850.indexOf(original);
    if (index >= 0) { bytes.push(0x80 + index); continue; }
    const plain = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    bytes.push(plain.length === 1 && plain.charCodeAt(0) <= 0x7f ? plain.charCodeAt(0) : 63);
  }
  return Buffer.from(bytes);
}

function encode(value, codePage) {
  if (codePage === 'utf8') return Buffer.from(String(value ?? ''), 'utf8');
  if (codePage === 'ascii') return Buffer.from(String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '?'), 'ascii');
  return encodeCp850(value);
}

function wrap(value, width) {
  const lines = [];
  for (const paragraph of String(value ?? '').split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (let word of words) {
      while (word.length > width) {
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!line) line = word;
      else if (line.length + word.length + 1 <= width) line += ' ' + word;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function renderComanda(payload, printer = {}) {
  const width = Math.max(24, Math.min(64, Number(printer.charactersPerLine || (Number(printer.paperWidth) === 58 ? 32 : 48))));
  const encoding = printer.codePage || 'cp850';
  const pieces = [];
  const command = (...bytes) => pieces.push(Buffer.from(bytes));
  const text = (value = '') => pieces.push(encode(value, encoding));
  const line = (value = '') => { text(value); command(0x0a); };
  const centered = (value) => {
    for (const row of wrap(value, width)) line(row.padStart(Math.floor((width + row.length) / 2)).slice(0, width));
  };

  const order = payload.order || {};
  const business = payload.business || {};
  command(0x1b, 0x40); // Inicializar
  command(0x1b, 0x74, Number(printer.codePageId ?? 2));
  command(0x1b, 0x61, 0x01); // Centrar
  command(0x1b, 0x45, 0x01); // Negrita
  centered(business.name || 'SYSTEM LAB POS');
  command(0x1d, 0x21, 0x11); // Doble ancho y alto
  centered(`COMANDA #${order.id}`);
  command(0x1d, 0x21, 0x00);
  command(0x1b, 0x45, 0x00);
  command(0x1b, 0x61, 0x00);
  line('-'.repeat(width));

  if (payload.station?.label) {
    command(0x1b, 0x45, 0x01);
    line(`DESTINO: ${String(payload.station.label).toUpperCase()}`);
    command(0x1b, 0x45, 0x00);
    line('-'.repeat(width));
  }

  const created = order.createdAt ? new Date(order.createdAt) : new Date();
  const date = new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica', dateStyle: 'short', timeStyle: 'short'
  }).format(created);
  line(date);
  line(order.label || 'Mostrador');
  if (order.tableNumber) line(`MESA: ${order.tableNumber}`);
  const fulfillment = { dine_in: 'EN EL LOCAL', pickup: 'PARA LLEVAR', express: 'EXPRESS' }[order.fulfillment] || String(order.fulfillment || '');
  if (fulfillment) line(fulfillment);
  line('-'.repeat(width));

  command(0x1b, 0x45, 0x01);
  command(0x1d, 0x21, 0x01); // Alto doble, ancho normal
  for (const item of order.items || []) {
    for (const row of wrap(`${item.quantity} x ${item.name}`, width)) line(row);
  }
  command(0x1d, 0x21, 0x00);
  command(0x1b, 0x45, 0x00);

  if (order.notes) {
    line('-'.repeat(width));
    command(0x1b, 0x45, 0x01);
    line('INDICACIONES:');
    for (const row of wrap(order.notes, width)) line(row);
    command(0x1b, 0x45, 0x00);
  }
  line('-'.repeat(width));
  command(0x1b, 0x61, 0x01);
  line('SYSTEM LAB POS');
  command(0x1b, 0x61, 0x00);
  command(0x1b, 0x64, Math.max(2, Math.min(12, Number(printer.feedLines || 5))));
  if (printer.autoCut !== false) command(0x1d, 0x56, 0x00);
  return Buffer.concat(pieces);
}

function renderReceipt(payload, printer = {}) {
  const width = Math.max(24, Math.min(64, Number(printer.charactersPerLine || (Number(printer.paperWidth) === 58 ? 32 : 48))));
  const encoding = printer.codePage || 'cp850';
  const pieces = [];
  const command = (...bytes) => pieces.push(Buffer.from(bytes));
  const text = (value = '') => pieces.push(encode(value, encoding));
  const line = (value = '') => { text(value); command(0x0a); };
  const centered = (value) => {
    for (const row of wrap(value, width)) line(row.padStart(Math.floor((width + row.length) / 2)).slice(0, width));
  };
  const amount = value => `CRC ${Number(value || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const order = payload.order || {};
  const business = payload.business || {};

  command(0x1b, 0x40);
  command(0x1b, 0x74, Number(printer.codePageId ?? 2));
  command(0x1b, 0x61, 0x01);
  command(0x1b, 0x45, 0x01);
  centered(business.name || 'SYSTEM LAB POS');
  command(0x1d, 0x21, 0x11);
  centered(`COMPROBANTE #${order.id}`);
  command(0x1d, 0x21, 0x00);
  command(0x1b, 0x45, 0x00);
  command(0x1b, 0x61, 0x00);
  line('-'.repeat(width));

  const paid = order.paidAt || order.createdAt;
  const date = new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica', dateStyle: 'short', timeStyle: 'short'
  }).format(paid ? new Date(paid) : new Date());
  line(date);
  if (order.customerName) line(`CLIENTE: ${order.customerName}`);
  if (order.label) line(order.label);
  line('-'.repeat(width));

  for (const item of order.items || []) {
    for (const row of wrap(`${item.quantity} x ${item.name}`, width)) line(row);
    line(amount(item.subtotal));
  }
  line('-'.repeat(width));
  if (Number(order.discount)) line(`DESCUENTO: ${amount(order.discount)}`);
  if (Number(order.tax)) line(`IMPUESTO: ${amount(order.tax)}`);
  if (Number(order.packagingTotal)) line(`EMPAQUES: ${amount(order.packagingTotal)}`);
  if (Number(order.serviceTotal)) line(`SERVICIO: ${amount(order.serviceTotal)}`);
  command(0x1b, 0x45, 0x01);
  line(`TOTAL: ${amount(order.total)}`);
  command(0x1b, 0x45, 0x00);
  const payment = { cash: 'EFECTIVO', card: 'TARJETA', sinpe: 'SINPE', transfer: 'TRANSFERENCIA' }[order.paymentMethod] || String(order.paymentMethod || '');
  if (payment) line(`PAGO: ${payment}`);
  if (order.paymentMethod === 'cash') {
    line(`RECIBIDO: ${amount(order.received)}`);
    line(`VUELTO: ${amount(order.change)}`);
  }
  line('-'.repeat(width));
  command(0x1b, 0x61, 0x01);
  centered('GRACIAS POR SU COMPRA');
  centered('Comprobante interno');
  centered('No es factura electronica');
  command(0x1b, 0x61, 0x00);
  command(0x1b, 0x64, Math.max(2, Math.min(12, Number(printer.feedLines || 5))));
  if (printer.autoCut !== false) command(0x1d, 0x56, 0x00);
  return Buffer.concat(pieces);
}

function renderTest(station, printer = {}) {
  const width = Math.max(24, Math.min(64, Number(printer.charactersPerLine || (Number(printer.paperWidth) === 58 ? 32 : 48))));
  const encoding = printer.codePage || 'cp850';
  const pieces = [];
  const command = (...bytes) => pieces.push(Buffer.from(bytes));
  const line = (value = '') => { pieces.push(encode(value, encoding)); command(0x0a); };
  const centered = value => line(String(value).slice(0, width).padStart(Math.floor((width + Math.min(width, String(value).length)) / 2)));
  command(0x1b, 0x40);
  command(0x1b, 0x74, Number(printer.codePageId ?? 2));
  command(0x1b, 0x61, 0x01);
  command(0x1b, 0x45, 0x01);
  centered('SYSTEM LAB PRINT AGENT');
  centered('PRUEBA DE IMPRESION');
  command(0x1b, 0x45, 0x00);
  line('-'.repeat(width));
  centered(`DESTINO: ${String(station?.label || station?.key || 'IMPRESORA').toUpperCase()}`);
  centered('Configuracion correcta');
  command(0x1b, 0x61, 0x00);
  command(0x1b, 0x64, Math.max(2, Math.min(12, Number(printer.feedLines || 5))));
  if (printer.autoCut !== false) command(0x1d, 0x56, 0x00);
  return Buffer.concat(pieces);
}

module.exports = { encodeCp850, wrap, renderComanda, renderReceipt, renderTest };
