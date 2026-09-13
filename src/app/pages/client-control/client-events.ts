import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ManagedClientOption { id: number; name: string; }
interface ClientEvent { id: number; client_id: number; title: string; description: string | null; event_date: string; created_at: string; updated_at: string; }

@Component({
  selector: 'app-client-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-events.html',
  styleUrl: './client-events.scss',
})
export class ClientEvents implements OnChanges {
  private readonly http = inject(HttpClient);
  @Input({ required: true }) apiBase = '';
  @Input() clients: ManagedClientOption[] = [];

  protected readonly events = signal<ClientEvent[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected selectedClientId = 0;
  protected title = '';
  protected eventDate = '';
  protected description = '';
  protected monthCursor = this.monthStart(new Date());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clients'] && !this.selectedClientId && this.clients.length) this.selectedClientId = this.clients[0].id;
    if (changes['apiBase'] && this.apiBase) this.loadEvents();
  }

  protected loadEvents(): void {
    if (!this.apiBase) return;
    this.loading.set(true); this.error.set('');
    this.http.get<ClientEvent[]>(`${this.apiBase}/client-management/events`).subscribe({
      next: data => { this.events.set(data); this.loading.set(false); },
      error: () => { this.error.set('No se pudieron cargar los eventos.'); this.loading.set(false); },
    });
  }

  protected addEvent(): void {
    if (!this.selectedClientId || this.title.trim().length < 2 || !this.eventDate) return;
    this.http.post<ClientEvent>(`${this.apiBase}/client-management/clients/${this.selectedClientId}/events`, {
      title: this.title.trim(), event_date: this.eventDate, description: this.description.trim() || null,
    }).subscribe({
      next: saved => {
        this.events.update(items => [...items, saved].sort((a,b) => a.event_date.localeCompare(b.event_date) || a.id-b.id));
        this.title=''; this.eventDate=''; this.description='';
        const [y,m] = saved.event_date.split('-').map(Number); this.monthCursor = new Date(y,m-1,1);
      },
      error: () => this.error.set('No se pudo guardar el evento.'),
    });
  }

  protected deleteEvent(item: ClientEvent): void {
    if (!confirm(`¿Eliminar “${item.title}”?`)) return;
    this.http.delete(`${this.apiBase}/client-management/events/${item.id}`).subscribe({
      next: () => this.events.update(items => items.filter(x => x.id !== item.id)),
      error: () => this.error.set('No se pudo eliminar el evento.'),
    });
  }

  protected previousMonth(): void { this.monthCursor = new Date(this.monthCursor.getFullYear(), this.monthCursor.getMonth()-1, 1); }
  protected nextMonth(): void { this.monthCursor = new Date(this.monthCursor.getFullYear(), this.monthCursor.getMonth()+1, 1); }
  protected monthLabel(): string { return new Intl.DateTimeFormat('es-CR',{month:'long',year:'numeric'}).format(this.monthCursor); }
  protected clientName(id:number): string { return this.clients.find(c=>c.id===id)?.name ?? 'Cliente'; }
  protected eventsForDate(date:string): ClientEvent[] { return this.events().filter(e=>e.event_date===date); }
  protected calendarDays(): Array<{date:string; day:number; current:boolean; today:boolean}> {
    const y=this.monthCursor.getFullYear(), m=this.monthCursor.getMonth();
    const first=new Date(y,m,1); const mondayOffset=(first.getDay()+6)%7;
    const start=new Date(y,m,1-mondayOffset); const today=this.localDate(new Date());
    return Array.from({length:42},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return {date:this.localDate(d),day:d.getDate(),current:d.getMonth()===m,today:this.localDate(d)===today}; });
  }
  protected upcoming(): ClientEvent[] { const today=this.localDate(new Date()); return this.events().filter(e=>e.event_date>=today).slice(0,12); }
  private localDate(d:Date):string { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
  private monthStart(d:Date):Date { return new Date(d.getFullYear(),d.getMonth(),1); }
}
