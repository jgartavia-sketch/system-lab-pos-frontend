const test = require('node:test');
const assert = require('node:assert/strict');
const { encodeCp850, wrap, renderComanda } = require('../escpos');

test('CP850 conserva caracteres españoles comunes', () => {
  const bytes = encodeCp850('Café, piña, jalapeño, ÚLTIMO');
  assert.equal(bytes.includes(63), false);
});

test('el ajuste de líneas respeta el ancho', () => {
  const lines = wrap('Dos hamburguesas especiales sin cebolla y con salsa aparte', 24);
  assert.ok(lines.length > 1);
  assert.ok(lines.every(line => line.length <= 24));
});

test('la comanda produce comandos ESC/POS, contenido y corte', () => {
  const bytes = renderComanda({
    business: { name: "Shirley's" },
    order: {
      id: 285,
      label: 'Mesa 4',
      tableNumber: 4,
      fulfillment: 'dine_in',
      createdAt: '2026-09-19T18:00:00Z',
      items: [{ quantity: 2, name: 'Casado con pollo' }],
      notes: 'Sin cebolla'
    }
  }, { paperWidth: 80, charactersPerLine: 48, codePage: 'cp850', codePageId: 2, autoCut: true });
  assert.deepEqual([...bytes.subarray(0, 2)], [0x1b, 0x40]);
  assert.ok(bytes.includes(Buffer.from('COMANDA #285')));
  assert.ok(bytes.includes(Buffer.from([0x1d, 0x56, 0x00])));
});
