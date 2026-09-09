const timezone = 'America/Costa_Rica';
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });

export function posDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // The database stores UTC; older responses can omit the timezone suffix.
  return new Date(/T/.test(value) && !/(Z|[+-]\d\d:\d\d)$/i.test(value) ? value + 'Z' : value);
}

export function posDay(value: string | Date): string {
  const parts = dayFormatter.formatToParts(posDate(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function posDayLabel(day: string): string {
  return new Intl.DateTimeFormat('es-CR', { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(day + 'T12:00:00-06:00'));
}

export interface OrderDay {
  day: string;
  label: string;
  orders: any[];
  pending: number;
  lanes: { status: string; orders: any[] }[];
}

export function groupOrderDays(orders: any[], kitchen = false): OrderDay[] {
  const groups = new Map<string, any[]>();
  const statuses = ['queued', 'preparing', 'ready'];
  for (const order of orders) {
    if (kitchen && (!statuses.includes(order.kitchen_status) || ['cancelled', 'refunded'].includes(order.status))) continue;
    const day = posDay(order.created_at);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(order);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([day, rows]) => {
    const sorted = [...rows].sort((a, b) => posDate(a.created_at).getTime() - posDate(b.created_at).getTime() || a.id - b.id);
    return {
      day, label: posDayLabel(day), orders: kitchen ? sorted : [...sorted].reverse(),
      pending: rows.filter(o => ['open', 'queued', 'preparing', 'ready'].includes(o.status)).length,
      lanes: statuses.map(status => ({ status, orders: sorted.filter(o => o.kitchen_status === status) })),
    };
  });
}

export function stepQuantity(value: number | string | null, direction: -1 | 1): number {
  const quantity = Number(value);
  // Buttons always move by one; manually entered weights keep their precision.
  const current = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  if (direction < 0 && current <= 1) return current;
  return Math.round((current + direction) * 1000) / 1000;
}
