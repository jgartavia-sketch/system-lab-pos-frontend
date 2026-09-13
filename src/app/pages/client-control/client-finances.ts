import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type MovementType = 'income' | 'expense';
type Currency = 'CRC' | 'USD';

interface ManagedClientLite {
  id: number;
  name: string;
}

interface FinanceMovement {
  id: number;
  client_id: number | null;
  movement_type: MovementType;
  amount: number;
  currency: Currency;
  category: string;
  concept: string;
  payment_method: string | null;
  movement_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FinanceSummary {
  income: number;
  expenses: number;
  profit: number;
  movement_count: number;
}

@Component({
  selector: 'app-client-finances',
  imports: [CommonModule, FormsModule],
  templateUrl: './client-finances.html',
  styleUrl: './client-finances.scss',
})
export class ClientFinances implements OnInit {
  private readonly http = inject(HttpClient);

  @Input({ required: true }) apiBase = '';
  @Input() clients: ManagedClientLite[] = [];

  protected readonly movements = signal<FinanceMovement[]>([]);
  protected readonly summary = signal<FinanceSummary>({
    income: 0,
    expenses: 0,
    profit: 0,
    movement_count: 0,
  });
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected movementType: MovementType = 'income';
  protected amount: number | null = null;
  protected currency: Currency = 'CRC';
  protected category = 'Mensualidades';
  protected concept = '';
  protected clientId: number | null = null;
  protected paymentMethod = 'SINPE';
  protected movementDate = new Date().toISOString().slice(0, 10);
  protected notes = '';
  protected month = new Date().toISOString().slice(0, 7);

  protected readonly incomeCategories = [
    'Mensualidades',
    'Desarrollo inicial',
    'Publicidad',
    'Dominio',
    'Hosting',
    'Correo empresarial',
    'Otro ingreso',
  ];

  protected readonly expenseCategories = [
    'Infraestructura',
    'Publicidad',
    'PR Visual Media',
    'Dominios',
    'Hosting',
    'Software',
    'Transporte',
    'Compras',
    'Servicios profesionales',
    'Impuestos',
    'Otro gasto',
  ];

  protected readonly paymentMethods = [
    'SINPE',
    'Transferencia',
    'Efectivo',
    'Tarjeta',
    'PayPal',
    'Otro',
  ];

  ngOnInit(): void {
    this.load();
  }

  protected typeChanged(): void {
    this.category = this.movementType === 'income'
      ? this.incomeCategories[0]
      : this.expenseCategories[0];
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');

    this.http.get<FinanceMovement[]>(
      `${this.apiBase}/client-management/finances/movements?month=${this.month}`,
    ).subscribe({
      next: (items) => {
        this.movements.set(items);
        this.loadSummary();
      },
      error: () => {
        this.error.set('No se pudieron cargar los movimientos financieros.');
        this.loading.set(false);
      },
    });
  }

  private loadSummary(): void {
    this.http.get<FinanceSummary>(
      `${this.apiBase}/client-management/finances/summary?month=${this.month}&currency=${this.currency}`,
    ).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo calcular el resumen financiero.');
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    if (!this.amount || this.amount <= 0 || this.concept.trim().length < 2 || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.http.post<FinanceMovement>(
      `${this.apiBase}/client-management/finances/movements`,
      {
        client_id: this.clientId || null,
        movement_type: this.movementType,
        amount: this.amount,
        currency: this.currency,
        category: this.category,
        concept: this.concept.trim(),
        payment_method: this.paymentMethod || null,
        movement_date: this.movementDate,
        notes: this.notes.trim() || null,
      },
    ).subscribe({
      next: () => {
        this.amount = null;
        this.concept = '';
        this.notes = '';
        this.saving.set(false);
        this.load();
      },
      error: (response) => {
        this.error.set(response?.error?.detail ?? 'No se pudo guardar el movimiento.');
        this.saving.set(false);
      },
    });
  }

  protected remove(item: FinanceMovement): void {
    if (!confirm(`¿Eliminar "${item.concept}"?`)) {
      return;
    }

    this.http.delete(
      `${this.apiBase}/client-management/finances/movements/${item.id}`,
    ).subscribe({
      next: () => this.load(),
      error: () => this.error.set('No se pudo eliminar el movimiento.'),
    });
  }

  protected clientName(id: number | null): string {
    if (!id) return 'System Lab';
    return this.clients.find((client) => client.id === id)?.name ?? 'Cliente';
  }

  protected symbol(currency: Currency): string {
    return currency === 'CRC' ? '₡' : '$';
  }

  protected categories(): string[] {
    return this.movementType === 'income'
      ? this.incomeCategories
      : this.expenseCategories;
  }
}
