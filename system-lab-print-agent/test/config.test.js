const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeConfig, publicStations } = require('../lib');

test('migra la impresora única de la versión 1 a Cocina', () => {
  const config = mergeConfig({ printer: { type: 'windows', name: 'COCINA' } });
  assert.equal(config.stations.kitchen.name, 'COCINA');
  assert.equal(config.stations.bar.name, '');
  assert.equal(config.stations.receipt.name, '');
});

test('conserva estaciones personalizadas independientes', () => {
  const config = mergeConfig({
    stations: {
      kitchen: { label: 'Cocina', type: 'windows', name: 'COCINA' },
      bar: { label: 'Bar', type: 'windows', name: 'BAR' },
      receipt: { label: 'Cliente', type: 'windows', name: 'CAJA' },
      postres: { label: 'Postres', type: 'network', host: '192.168.1.50', port: 9100 }
    }
  });
  const stations = publicStations(config.stations);
  assert.equal(stations.filter(station => station.configured).length, 4);
  assert.equal(config.stations.bar.name, 'BAR');
  assert.equal(config.stations.receipt.name, 'CAJA');
  assert.equal(config.stations.postres.host, '192.168.1.50');
});
