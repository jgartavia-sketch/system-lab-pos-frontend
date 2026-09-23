import { Injectable } from '@angular/core';

export type PrintAgentState = 'checking' | 'online' | 'offline' | 'unconfigured';

export interface PrintStation {
  key: string;
  label: string;
  configured: boolean;
  printer?: { type: 'windows' | 'network'; name?: string; host?: string; port?: number };
}

interface PrintAgentHealth {
  ok: boolean;
  version: string;
  printerConfigured: boolean;
  printer?: { type: 'windows' | 'network'; name?: string; host?: string; port?: number };
  stations?: PrintStation[];
}

@Injectable({ providedIn: 'root' })
export class PrintAgentService {
  readonly defaultUrl = 'http://127.0.0.1:18181';
  url = localStorage.getItem('systemlab-print-agent-url') || this.defaultUrl;
  apiKey = localStorage.getItem('systemlab-print-agent-key') || '';
  state: PrintAgentState = 'checking';
  version = '';
  printerLabel = '';
  stations: PrintStation[] = [];
  lastError = '';

  save(url: string, apiKey: string) {
    this.url = (url || this.defaultUrl).trim().replace(/\/$/, '');
    this.apiKey = (apiKey || '').trim();
    localStorage.setItem('systemlab-print-agent-url', this.url);
    localStorage.setItem('systemlab-print-agent-key', this.apiKey);
  }

  async check(): Promise<boolean> {
    this.state = 'checking';
    this.lastError = '';
    try {
      const response = await this.fetchWithTimeout('/v1/health', { method: 'GET' }, 2500);
      if (!response.ok) throw new Error('El agente respondió con estado ' + response.status + '.');
      const health = (await response.json()) as PrintAgentHealth;
      this.version = health.version || '';
      this.stations = health.stations || [{ key: 'kitchen', label: 'Cocina', configured: health.printerConfigured, printer: health.printer }];
      this.printerLabel = this.stations
        .filter(station => station.configured)
        .map(station => `${station.label}: ${this.deviceLabel(station.printer)}`)
        .join(' · ');
      this.state = this.stations.some(station => station.configured) ? 'online' : 'unconfigured';
      return this.state === 'online';
    } catch (error: any) {
      this.state = 'offline';
      this.stations = [];
      this.lastError = error?.name === 'AbortError'
        ? 'El agente local no respondió a tiempo.'
        : 'No se encontró System Lab Print Agent. Verificá que esté iniciado y que Chrome tenga permitido el acceso a la red local.';
      return false;
    }
  }

  stationOptions() {
    const base: PrintStation[] = [
      { key: 'kitchen', label: 'Cocina', configured: false },
      { key: 'bar', label: 'Bar / bebidas', configured: false }
    ];
    const merged = new Map(base.map(item => [item.key, item]));
    for (const station of this.stations) {
      if (station.key !== 'receipt') merged.set(station.key, station);
    }
    return [...merged.values()];
  }

  async printPreparation(order: any, business: any): Promise<{ results: any[]; duplicate: boolean }> {
    this.requireKey();
    const groups = new Map<string, any[]>();
    for (const item of order.items || []) {
      const station = String(item.print_station || 'kitchen');
      if (station === 'none') continue;
      groups.set(station, [...(groups.get(station) || []), item]);
    }
    if (!groups.size) return { results: [], duplicate: false };

    const results = [];
    for (const [station, items] of groups) {
      const payload = this.basePayload(order, business, items);
      const result = await this.send('/v1/print/comanda', {
        ...payload,
        station,
        idempotencyKey: `${business?.id || 'business'}:comanda:${station}:${order.id}:${order.revision || 0}`
      }, 'El agente no pudo imprimir la comanda.');
      results.push(result);
    }
    return { results, duplicate: results.length > 0 && results.every(result => result.duplicate) };
  }

  async printComanda(order: any, business: any) {
    return this.printPreparation(order, business);
  }

  async printReceipt(order: any, business: any, customerName = 'Consumidor final'): Promise<any> {
    this.requireKey();
    const payload = this.basePayload(order, business, order.items || []);
    return this.send('/v1/print/receipt', {
      ...payload,
      idempotencyKey: `${business?.id || 'business'}:receipt:${order.id}:${order.revision || 0}`,
      order: {
        ...payload.order,
        customerName,
        paidAt: order.paid_at,
        subtotal: Number(order.subtotal || 0),
        discount: Number(order.discount || 0),
        tax: Number(order.tax || 0),
        packagingTotal: Number(order.packaging_total || 0),
        serviceTotal: Number(order.service_total || 0),
        total: Number(order.total || 0),
        paymentMethod: order.payment_method,
        received: Number(order.received || 0),
        change: Number(order.change || 0)
      }
    }, 'El agente no pudo imprimir el comprobante.');
  }

  private basePayload(order: any, business: any, items: any[]) {
    return {
      business: { id: business?.id, name: business?.name || 'System Lab POS' },
      order: {
        id: order.id,
        label: order.label || 'Mostrador',
        tableNumber: order.table_number ?? null,
        fulfillment: order.fulfillment || 'dine_in',
        sourceChannel: order.source_channel || 'pos',
        createdAt: order.created_at,
        notes: order.notes || '',
        items: items.map((item: any) => ({
          quantity: Number(item.quantity),
          name: String(item.name || 'Producto'),
          subtotal: Number(item.subtotal || 0)
        }))
      }
    };
  }

  private async send(path: string, payload: any, fallback: string) {
    const response = await this.fetchWithTimeout(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-System-Lab-Key': this.apiKey },
      body: JSON.stringify(payload)
    }, 10000);
    const raw = await response.text();
    let result: any = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch { /* respuesta no JSON */ }
    if (!response.ok) {
      if (response.status === 401) this.state = 'unconfigured';
      throw new Error(result.error || fallback);
    }
    this.state = 'online';
    return result;
  }

  private requireKey() {
    if (this.apiKey) return;
    this.state = 'unconfigured';
    throw new Error('Falta vincular la clave del agente de impresión.');
  }

  private deviceLabel(printer?: PrintStation['printer']) {
    return printer?.type === 'network'
      ? `${printer.host}:${printer.port || 9100}`
      : printer?.name || 'Sin seleccionar';
  }

  private fetchWithTimeout(path: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(this.url + path, { ...init, cache: 'no-store', signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }
}
