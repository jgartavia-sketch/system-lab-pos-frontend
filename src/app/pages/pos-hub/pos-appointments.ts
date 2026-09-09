import { posDate, posDay, posDayLabel } from './pos-order-groups';

export interface AppointmentDay {
  day: string;
  label: string;
  appointments: any[];
}

// A reservation stays in today's list until its status is completed/cancelled.
// Past dates remain editable in history; no record is discarded or changed.
export function appointmentOverview(appointments: any[], today: string) {
  const days = new Map<string, any[]>();
  const history: any[] = [];
  let todayCount = 0;
  let upcomingCount = 0;
  let pendingCount = 0;
  const time = (row: any) => posDate(row.at).getTime();

  for (const appointment of appointments) {
    const day = Number.isFinite(time(appointment)) ? posDay(appointment.at) : '';
    if (day >= today && ['pending', 'confirmed'].includes(appointment.status)) {
      if (!days.has(day)) days.set(day, []);
      days.get(day)!.push(appointment);
      if (day === today) todayCount++;
      else upcomingCount++;
      if (appointment.status === 'pending') pendingCount++;
    } else {
      history.push(appointment);
    }
  }

  const groups: AppointmentDay[] = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rows]) => ({
      day,
      label: posDayLabel(day),
      appointments: [...rows].sort((a, b) => time(a) - time(b) || a.id - b.id),
    }));
  return {
    todayCount,
    upcomingCount,
    pendingCount,
    groups,
    history: history.sort((a, b) => (time(b) || 0) - (time(a) || 0) || b.id - a.id),
  };
}
