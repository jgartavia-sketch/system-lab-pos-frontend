import { appointmentOverview } from './pos-appointments';

describe('Resumen de reservaciones', () => {
  it('respeta el día de Costa Rica y conserva todos los registros fuera del resumen en el historial', () => {
    const rows = [
      { id: 1, at: '2026-09-09T05:59:00Z', status: 'pending' }, // Yesterday in CR.
      { id: 2, at: '2026-09-09T06:00:00Z', status: 'confirmed' },
      { id: 3, at: '2026-09-10T05:59:00Z', status: 'pending' }, // Still today in CR.
      { id: 4, at: '2026-09-10T06:00:00Z', status: 'pending' },
      { id: 5, at: '2026-09-11T16:00:00Z', status: 'cancelled' },
      { id: 6, at: '2026-09-09T17:00:00Z', status: 'completed' },
    ];
    const original = JSON.stringify(rows);
    const result = appointmentOverview(rows, '2026-09-09');
    expect(result.todayCount).toBe(2);
    expect(result.upcomingCount).toBe(1);
    expect(result.pendingCount).toBe(2);
    expect(
      result.groups.map((group) => [group.day, group.appointments.map((row) => row.id)]),
    ).toEqual([
      ['2026-09-09', [2, 3]],
      ['2026-09-10', [4]],
    ]);
    expect(result.history.map((row) => row.id)).toEqual([5, 6, 1]);
    expect(JSON.stringify(rows)).toBe(original);
    expect([
      ...result.groups.flatMap((group) => group.appointments),
      ...result.history,
    ]).toHaveLength(rows.length);
  });

  it('ordena por hora e identificador y actualiza el resumen cuando se completa una reservación', () => {
    const rows = [
      { id: 3, at: '2026-09-09T18:00:00Z', status: 'confirmed' },
      { id: 2, at: '2026-09-09T17:00:00', status: 'pending' }, // Legacy UTC without suffix.
      { id: 1, at: '2026-09-09T11:00:00-06:00', status: 'pending' },
    ];
    expect(
      appointmentOverview(rows, '2026-09-09').groups[0].appointments.map((row) => row.id),
    ).toEqual([1, 2, 3]);
    rows[0] = { ...rows[0], status: 'completed' };
    const updated = appointmentOverview(rows, '2026-09-09');
    expect(updated.todayCount).toBe(2);
    expect(updated.history.map((row) => row.id)).toEqual([3]);
    const empty = appointmentOverview([], '2026-09-09');
    expect(empty.groups).toEqual([]);
    expect(empty.history).toEqual([]);
    expect(empty.todayCount + empty.upcomingCount + empty.pendingCount).toBe(0);
  });
});
