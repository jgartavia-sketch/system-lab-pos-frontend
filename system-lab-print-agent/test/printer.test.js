const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { printRaw } = require('../printer');

test('envía bytes RAW completos a una impresora TCP', async () => {
  const expected = Buffer.from([0x1b, 0x40, 0x48, 0x6f, 0x6c, 0x61, 0x0a]);
  let received = Buffer.alloc(0);
  const server = net.createServer(socket => {
    socket.on('data', chunk => { received = Buffer.concat([received, chunk]); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await printRaw(expected, { type: 'network', host: '127.0.0.1', port: address.port }, 'test-job');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(received, expected);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
