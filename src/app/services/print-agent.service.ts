import { Injectable } from '@angular/core';

export type PrintAgentState = 'checking' | 'online' | 'offline' | 'unconfigured';

interface PrintAgentHealth {
  ok: boolean;
  version: string;
  printerConfigured: boolean;
  printer?: { type: 'windows' | 'network'; name?: string; host?: string; port?: number };
}

@Injectable({ providedIn: 'root' })
export class PrintAgentService {
  readonly defaultUrl = 'http://127.0.0.1:18181';
  url = localStorage.getItem('systemlab-print-agent-url') || this.defaultUrl;
  apiKey = localStorage.getItem('systemlab-print-agent-key') || '';
  state: PrintAgentState = 'checking';
  version = '';
  printerLabel = '';
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
      this.printerLabel = health.printer?.type === 'network'
        ? `${health.printer.host}:${health.printer.port || 9100}`
        : health.printer?.name || '';
      this.state = health.printerConfigured ? 'online' : 'unconfigured';
      return health.printerConfigured;
    } catch (error: any) {
      this.state = 'offline';
      this.lastError = error?.name === 'AbortError'
        ? 'El agente local no respondió a tiempo.'
        : 'No se encontró System Lab Print Agent. Verificá que esté iniciado y que Chrome tenga permitido el acceso a la red local.';
      return false;
    }
  }

  async printComanda(order: any, business: any): Promise<{ jobId: string; duplicate?: boolean }> {
    if (!this.apiKey) {
      this.state = 'unconfigured';
      throw new Error('Falta vincular la clave del agente de impresión.');
    }

    const response = await this.fetchWithTimeout('/v1/print/comanda', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-System-Lab-Key': this.apiKey
      },
      body: JSON.stringify({
        idempotencyKey: `${business?.id || 'business'}:comanda:${order.id}:${order.revision || 0}`,
        business: {
          id: business?.id,
          name: business?.name || 'System Lab POS'
        },
        order: {
          id: order.id,
          label: order.label || 'Mostrador',
          tableNumber: order.table_number ?? null,
          fulfillment: order.fulfillment || 'dine_in',
          sourceChannel: order.source_channel || 'pos',
          createdAt: order.created_at,
          notes: order.notes || '',
          items: (order.items || []).map((item: any) => ({
            quantity: Number(item.quantity),
            name: String(item.name || 'Producto')
          }))
        }
      })
    }, 7000);

    const raw = await response.text();
    let result: any = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch { /* respuesta no JSON */ }
    if (!response.ok) {
      if (response.status === 401) this.state = 'unconfigured';
      throw new Error(result.error || 'El agente no pudo imprimir la comanda.');
    }
    this.state = 'online';
    return result;
  }

  private fetchWithTimeout(path: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(this.url + path, { ...init, cache: 'no-store', signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }
}
