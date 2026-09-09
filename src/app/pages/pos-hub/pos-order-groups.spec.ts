import { groupOrderDays, posDay, stepQuantity } from './pos-order-groups';

describe('Fechas y cantidades del POS', () => {
  it('separa los pedidos al cambiar el día en Costa Rica, incluyendo respuestas UTC antiguas', () => {
    const groups = groupOrderDays([
      {id:1,created_at:'2026-09-09T05:59:59Z',status:'paid'},
      {id:2,created_at:'2026-09-09T06:00:00Z',status:'open'},
      {id:3,created_at:'2026-09-09T07:00:00',status:'cancelled'},
    ]);
    expect(groups.map(group => group.day)).toEqual(['2026-09-09','2026-09-08']);
    expect(groups[0].orders.map(order => order.id)).toEqual([3,2]);
    expect(groups[1].orders.map(order => order.id)).toEqual([1]);
    expect(groups[0].pending).toBe(1);
    expect(posDay('2026-09-09T01:00:00+02:00')).toBe('2026-09-08');
  });
  it('ordena cada carrusel por llegada y mantiene separados día y estado', () => {
    const orders = [
      {id:4,created_at:'2026-09-09T15:00:00Z',status:'paid',kitchen_status:'queued'},
      {id:2,created_at:'2026-09-09T14:00:00Z',status:'preparing',kitchen_status:'preparing'},
      {id:3,created_at:'2026-09-09T14:00:00Z',status:'ready',kitchen_status:'ready'},
      {id:1,created_at:'2026-09-09T13:00:00Z',status:'queued',kitchen_status:'queued'},
      {id:5,created_at:'2026-09-08T13:00:00Z',status:'paid',kitchen_status:'ready'},
      {id:6,created_at:'2026-09-09T15:00:00Z',status:'refunded',kitchen_status:'ready'},
      {id:7,created_at:'2026-09-09T15:00:00Z',status:'paid',kitchen_status:'served'},
    ];
    const groups = groupOrderDays(orders,true);
    expect(groups[0].lanes.map(lane => lane.orders.map(order => order.id))).toEqual([[1,4],[2],[3]]);
    expect(groups[1].orders.map(order => order.id)).toEqual([5]);
    expect(orders[0].id).toBe(4);
  });
  it('cuenta unidades de uno en uno y conserva cantidades fraccionarias ingresadas manualmente', () => {
    let quantity = 1;
    quantity = stepQuantity(quantity,1); expect(quantity).toBe(2);
    quantity = stepQuantity(quantity,1); expect(quantity).toBe(3);
    quantity = stepQuantity(quantity,-1); expect(quantity).toBe(2);
    expect(stepQuantity(1,-1)).toBe(1);
    expect(stepQuantity(0.5,1)).toBe(1.5);
    expect(stepQuantity(1.5,-1)).toBe(0.5);
  });
});
