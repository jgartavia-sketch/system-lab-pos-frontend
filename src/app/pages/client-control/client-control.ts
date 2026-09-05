import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Tab = 'services' | 'progress' | 'payments';
type WorkStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
type PaymentStatus = 'pending' | 'paid' | 'overdue';
type PaymentStage = 'overdue' | 'pending' | 'scheduled' | 'paid';

interface ServiceDefinition { key: string; label: string; }
interface ServiceStatus { id: number; client_id: number; service_key: string; is_active: boolean; notes: string | null; updated_at: string; }
interface Milestone { id: number; client_id: number; title: string; description: string | null; status: WorkStatus; priority: 'low' | 'medium' | 'high'; due_date: string | null; }
interface Payment {
  id: number; client_id: number; product_service: string; value: number;
  currency: 'CRC' | 'USD'; status: PaymentStatus; period_start: string | null;
  period_end: string | null; due_date: string | null; payment_date: string | null;
  next_payment_date: string | null; detail: string | null;
}
interface ManagedClient { id: number; name: string; slug: string; website_url: string | null; is_active: boolean; service_statuses: ServiceStatus[]; milestones: Milestone[]; payments: Payment[]; }
interface Dashboard { services: ServiceDefinition[]; clients: ManagedClient[]; }

@Component({
  selector: 'app-client-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './client-control.html',
  styleUrl: './client-control.scss',
})
export class ClientControl {
  private readonly http = inject(HttpClient);
  private readonly apiBase =
    (globalThis as typeof globalThis & { SYSTEM_LAB_API_URL?: string }).SYSTEM_LAB_API_URL
    ?? (globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : 'https://system-lab-pos-backend.onrender.com');

  protected readonly activeTab = signal<Tab>('services');
  protected readonly dashboard = signal<Dashboard>({ services: [], clients: [] });
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly savingKeys = signal(new Set<string>());
  protected readonly creatingClient = signal(false);
  protected newClientName = '';
  protected newClientWebsite = '';
  protected selectedClientId = 0;
  protected milestoneTitle = '';
  protected milestoneDescription = '';
  protected milestonePriority: 'low' | 'medium' | 'high' = 'medium';
  protected milestoneDueDate = '';
  protected readonly productOptions = ['Mensualidad System Lab', 'Dominio', 'Correo empresarial', 'Hosting', 'PostgreSQL', 'Publicidad semanal', 'Desarrollo inicial', 'Otro'];
  protected editingPaymentId: number | null = null;
  protected paymentProduct = 'Mensualidad System Lab';
  protected paymentCustomProduct = '';
  protected paymentValue: number | null = 25000;
  protected paymentCurrency: 'CRC' | 'USD' = 'CRC';
  protected paymentStatus: PaymentStatus = 'paid';
  protected paymentPeriodStart = '';
  protected paymentPeriodEnd = '';
  protected paymentDate = '';
  protected paymentNextDate = '';
  protected paymentDetail = '';
  protected settlingPaymentId: number | null = null;
  protected settlementNextDate = '';

  protected readonly activeServices = computed(() =>
    this.dashboard().clients.reduce((total, client) => total + client.service_statuses.filter((item) => item.is_active).length, 0),
  );
  protected readonly pendingWork = computed(() =>
    this.dashboard().clients.reduce((total, client) => total + client.milestones.filter((item) => item.status !== 'completed').length, 0),
  );
  protected readonly pendingPayments = computed(() =>
    this.dashboard().clients.reduce((total, client) => total + client.payments.filter((item) => item.status !== 'paid').length, 0),
  );

  constructor() { this.loadDashboard(); }

  protected setTab(tab: Tab): void { this.activeTab.set(tab); }

  protected loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<Dashboard>(`${this.apiBase}/client-management/dashboard`).subscribe({
      next: (data) => {
        this.dashboard.set(data);
        if (!this.selectedClientId && data.clients.length) this.selectedClientId = data.clients[0].id;
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo conectar con el backend. Verificá la URL de la API y que Render esté activo.');
        this.loading.set(false);
      },
    });
  }

  protected isServiceActive(client: ManagedClient, key: string): boolean {
    return client.service_statuses.some((item) => item.service_key === key && item.is_active);
  }

  protected addClient(): void {
    const name = this.newClientName.trim();
    if (name.length < 2 || this.creatingClient()) return;

    this.creatingClient.set(true);
    this.error.set('');
    this.http.post<ManagedClient>(`${this.apiBase}/client-management/clients`, {
      name,
      website_url: this.newClientWebsite.trim() || null,
    }).subscribe({
      next: (saved) => {
        this.dashboard.update((current) => ({
          ...current,
          clients: [...current.clients, saved].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        }));
        this.selectedClientId = saved.id;
        this.newClientName = '';
        this.newClientWebsite = '';
        this.creatingClient.set(false);
      },
      error: (response) => {
        this.error.set(response?.error?.detail ?? 'No se pudo crear el cliente.');
        this.creatingClient.set(false);
      },
    });
  }

  protected toggleService(client: ManagedClient, service: ServiceDefinition, checked: boolean): void {
    const savingKey = `${client.id}:${service.key}`;
    this.setSaving(savingKey, true);
    this.http.patch<ServiceStatus>(`${this.apiBase}/client-management/clients/${client.id}/services/${service.key}`, { is_active: checked }).subscribe({
      next: (saved) => {
        this.dashboard.update((current) => ({
          ...current,
          clients: current.clients.map((item) => item.id !== client.id ? item : {
            ...item,
            service_statuses: [...item.service_statuses.filter((status) => status.service_key !== service.key), saved],
          }),
        }));
        this.setSaving(savingKey, false);
      },
      error: () => { this.error.set(`No se pudo actualizar ${service.label} para ${client.name}.`); this.setSaving(savingKey, false); },
    });
  }

  protected isSaving(clientId: number, serviceKey: string): boolean { return this.savingKeys().has(`${clientId}:${serviceKey}`); }

  protected addMilestone(): void {
    if (!this.selectedClientId || this.milestoneTitle.trim().length < 2) return;
    this.http.post<Milestone>(`${this.apiBase}/client-management/clients/${this.selectedClientId}/milestones`, {
      title: this.milestoneTitle.trim(), description: this.milestoneDescription.trim() || null,
      status: 'pending', priority: this.milestonePriority, due_date: this.milestoneDueDate || null,
    }).subscribe({
      next: (saved) => {
        this.dashboard.update((current) => ({ ...current, clients: current.clients.map((client) => client.id === this.selectedClientId ? { ...client, milestones: [saved, ...client.milestones] } : client) }));
        this.milestoneTitle = ''; this.milestoneDescription = ''; this.milestoneDueDate = '';
      },
      error: () => this.error.set('No se pudo guardar la tarea.'),
    });
  }

  protected updateMilestoneStatus(item: Milestone, status: WorkStatus): void {
    this.http.patch<Milestone>(`${this.apiBase}/client-management/milestones/${item.id}`, { status }).subscribe({
      next: (saved) => this.replaceMilestone(saved),
      error: () => this.error.set('No se pudo actualizar el avance.'),
    });
  }

  protected savePayment(): void {
    const productService = this.paymentProduct === 'Otro' ? this.paymentCustomProduct.trim() : this.paymentProduct;
    if (!this.selectedClientId || !this.paymentValue || this.paymentValue <= 0 || productService.length < 2) return;
    const payload = {
      product_service: productService, value: this.paymentValue, currency: this.paymentCurrency,
      status: this.paymentStatus, period_start: this.paymentPeriodStart || null,
      period_end: this.paymentPeriodEnd || null, payment_date: this.paymentDate || null,
      next_payment_date: this.paymentNextDate || null, detail: this.paymentDetail.trim() || null,
    };
    const request = this.editingPaymentId
      ? this.http.patch<Payment>(`${this.apiBase}/client-management/payments/${this.editingPaymentId}`, payload)
      : this.http.post<Payment>(`${this.apiBase}/client-management/clients/${this.selectedClientId}/payments`, payload);
    request.subscribe({
      next: () => {
        this.resetPaymentForm();
        this.loadDashboard();
      },
      error: () => this.error.set('No se pudo registrar el pago.'),
    });
  }

  protected paymentProductChanged(): void {
    if (this.paymentProduct !== 'Publicidad semanal') return;
    this.paymentDetail = this.paymentDetail || 'Publicidad de lunes a sábado';
    if (this.paymentPeriodStart) this.calculateAdvertisingDates();
  }

  protected calculateAdvertisingDates(): void {
    if (this.paymentProduct !== 'Publicidad semanal' || !this.paymentPeriodStart) return;
    this.paymentPeriodEnd = this.addDays(this.paymentPeriodStart, 5);
    this.paymentNextDate = this.addDays(this.paymentPeriodStart, 7);
  }

  protected editPayment(item: Payment): void {
    this.editingPaymentId = item.id;
    this.selectedClientId = item.client_id;
    this.paymentProduct = this.productOptions.includes(item.product_service) ? item.product_service : 'Otro';
    this.paymentCustomProduct = this.paymentProduct === 'Otro' ? item.product_service : '';
    this.paymentValue = item.value;
    this.paymentCurrency = item.currency;
    this.paymentStatus = item.status;
    this.paymentPeriodStart = item.period_start ?? '';
    this.paymentPeriodEnd = item.period_end ?? '';
    this.paymentDate = item.payment_date ?? '';
    this.paymentNextDate = item.next_payment_date ?? '';
    this.paymentDetail = item.detail ?? '';
    globalThis.scrollTo({ top: 360, behavior: 'smooth' });
  }

  protected resetPaymentForm(): void {
    this.editingPaymentId = null;
    this.paymentProduct = 'Mensualidad System Lab';
    this.paymentCustomProduct = '';
    this.paymentValue = 25000;
    this.paymentCurrency = 'CRC';
    this.paymentStatus = 'paid';
    this.paymentPeriodStart = '';
    this.paymentPeriodEnd = '';
    this.paymentDate = '';
    this.paymentNextDate = '';
    this.paymentDetail = '';
  }

  protected beginPaymentSettlement(item: Payment): void {
    this.settlingPaymentId = item.id;
    this.settlementNextDate = '';
  }

  protected cancelPaymentSettlement(): void {
    this.settlingPaymentId = null;
    this.settlementNextDate = '';
  }

  protected confirmPaymentSettlement(item: Payment): void {
    this.http.patch<Payment>(`${this.apiBase}/client-management/payments/${item.id}`, {
      status: 'paid', next_payment_date: this.settlementNextDate || null,
    }).subscribe({
      next: () => { this.cancelPaymentSettlement(); this.loadDashboard(); },
      error: () => this.error.set('No se pudo acreditar el pago.'),
    });
  }

  protected clientName(id: number): string { return this.dashboard().clients.find((client) => client.id === id)?.name ?? 'Cliente'; }
  protected allPayments(): Payment[] { return this.dashboard().clients.flatMap((client) => client.payments).sort((a, b) => (b.payment_date ?? b.next_payment_date ?? '').localeCompare(a.payment_date ?? a.next_payment_date ?? '') || b.id - a.id); }
  protected paymentsForClient(client: ManagedClient): Payment[] { return [...client.payments].sort((a, b) => (b.due_date ?? b.payment_date ?? '').localeCompare(a.due_date ?? a.payment_date ?? '') || b.id - a.id); }
  protected paymentStage(item: Payment): PaymentStage {
    if (item.status === 'paid') return 'paid';
    if (!item.due_date) return item.status === 'overdue' ? 'overdue' : 'pending';
    const today = this.todayUtc();
    if (item.due_date < today) return 'overdue';
    return item.due_date <= this.addDays(today, 3) ? 'pending' : 'scheduled';
  }
  protected paymentsByStage(stage: PaymentStage): Array<{ payment: Payment; client: ManagedClient }> {
    return this.dashboard().clients.flatMap((client) => client.payments.map((payment) => ({ payment, client }))).filter(({ payment }) => this.paymentStage(payment) === stage);
  }
  protected milestonesByPriority(priority: 'low' | 'medium' | 'high'): Array<{ milestone: Milestone; client: ManagedClient }> {
    return this.dashboard().clients.flatMap((client) => client.milestones.map((milestone) => ({ milestone, client }))).filter(({ milestone }) => milestone.priority === priority && milestone.status !== 'completed');
  }
  protected statusLabel(status: string): string { return ({ pending: 'Pendiente', scheduled: 'Programado', in_progress: 'En proceso', completed: 'Listo', blocked: 'Bloqueado', paid: 'Pagado', overdue: 'Atrasado' } as Record<string, string>)[status] ?? status; }

  private replaceMilestone(saved: Milestone): void {
    this.dashboard.update((current) => ({ ...current, clients: current.clients.map((client) => ({ ...client, milestones: client.milestones.map((item) => item.id === saved.id ? saved : item) })) }));
  }

  private setSaving(key: string, saving: boolean): void {
    this.savingKeys.update((current) => { const next = new Set(current); saving ? next.add(key) : next.delete(key); return next; });
  }

  private addDays(value: string, days: number): string {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  private todayUtc(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
  }
}
