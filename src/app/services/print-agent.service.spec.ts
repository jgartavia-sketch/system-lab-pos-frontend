import { PrintAgentService } from './print-agent.service';

describe('PrintAgentService', () => {
  let service: PrintAgentService;

  beforeEach(() => {
    localStorage.clear();
    service = new PrintAgentService();
    service.apiKey = 'test-key';
  });

  afterEach(() => vi.restoreAllMocks());

  it('separa un pedido por estación y omite productos sin preparación', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ jobId: 'ok', printed: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
    const order = {
      id: 22, revision: 1, items: [
        { quantity: 1, name: 'Casado', print_station: 'kitchen' },
        { quantity: 2, name: 'Limonada', print_station: 'bar' },
        { quantity: 1, name: 'Bolsa', print_station: 'none' }
      ]
    };
    const result = await service.printPreparation(order, { id: 4, name: 'Restaurante' });
    expect(result.results).toHaveLength(2);
    const payloads = fetchMock.mock.calls.map(call => JSON.parse(String((call[1] as RequestInit).body)));
    expect(payloads.map(payload => payload.station)).toEqual(['kitchen', 'bar']);
    expect(payloads[0].order.items.map((item: any) => item.name)).toEqual(['Casado']);
    expect(payloads[1].order.items.map((item: any) => item.name)).toEqual(['Limonada']);
  });

  it('envía el comprobante completo a la ruta receipt', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ jobId: 'receipt', printed: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
    await service.printReceipt({
      id: 9, revision: 3, items: [{ quantity: 1, name: 'Cena', subtotal: 5000 }],
      total: 5000, payment_method: 'cash', received: 10000, change: 5000
    }, { id: 4, name: 'Restaurante' }, 'Cliente');
    expect(fetchMock.mock.calls[0][0]).toContain('/v1/print/receipt');
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload.order.customerName).toBe('Cliente');
    expect(payload.order.total).toBe(5000);
  });
});
