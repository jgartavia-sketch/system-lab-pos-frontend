import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { posDay } from './pos-order-groups';

@Component({selector:'app-pos-dashboard',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./pos-dashboard.html',styleUrl:'./pos-dashboard.scss'})
export class PosDashboard implements OnChanges, OnDestroy {
  @Input({required:true}) api = '';
  @Input({required:true}) businessId = 0;
  @Input() revision = '';
  @Output() showFinances = new EventEmitter<void>();
  start = posDay(new Date()).slice(0, 8) + '01';
  end = posDay(new Date());
  appliedStart = this.start;
  appliedEnd = this.end;
  private queryStart = this.start;
  private queryEnd = this.end;
  report: any = null;
  loading = false;
  error = '';
  chart: any = {series:[],ticks:[],dates:[],zero:220};
  private controller?: AbortController;
  private requestId = 0;
  private destroyed = false;
  constructor(private cd: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['businessId']) this.report = null;
    if (this.businessId) void this.fetchReport(this.queryStart, this.queryEnd);
  }
  ngOnDestroy() { this.destroyed = true; this.requestId++; this.controller?.abort(); }
  money(value: any) { return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(Number(value || 0)); }
  dayLabel(day: string) { return day.split('-').reverse().join('/'); }
  paymentName(key: string) { return ({cash:'Efectivo',card:'Tarjeta',sinpe:'SINPE',transfer:'Transferencia'} as Record<string,string>)[key] || key; }
  get topProducts(): any[] { return (this.report?.top_products || []).slice(0,5); }
  productWidth(product: any) { return 100 * Number(product.quantity) / Math.max(1, Number(this.topProducts[0]?.quantity)); }
  get grossProfit() { return this.report?.gross_profit ?? Number(this.report?.sales || 0)-Number(this.report?.tax || 0)-Number(this.report?.cost || 0); }
  get netSales() { return this.report?.net_sales ?? Number(this.report?.sales || 0)-Number(this.report?.tax || 0); }

  async load() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.start) || !/^\d{4}-\d{2}-\d{2}$/.test(this.end) || this.end < this.start) {
      this.error = 'Seleccioná una fecha inicial y una fecha final válidas.'; return;
    }
    if ((Date.parse(this.end)-Date.parse(this.start))/86400000 > 366) {
      this.error = 'Seleccioná un rango de hasta 366 días.'; return;
    }
    this.queryStart = this.start; this.queryEnd = this.end;
    await this.fetchReport(this.queryStart, this.queryEnd);
  }
  async fetchReport(start: string, end: string) {
    this.controller?.abort();
    const controller = new AbortController(); this.controller = controller;
    const id = ++this.requestId; const bid = this.businessId;
    this.loading = true; this.error = '';
    const timeout = setTimeout(() => controller.abort(),45000);
    try {
      const response = await fetch(`${this.api}/business/${bid}/reports?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
        headers:{Authorization:'Bearer '+(sessionStorage.getItem('systemlab-pos-token') || '')},signal:controller.signal,
      });
      const report = await response.json();
      if (id !== this.requestId || bid !== this.businessId) return;
      if (!response.ok) throw Error(typeof report.detail === 'string' ? report.detail : 'No se pudieron consultar los indicadores.');
      this.report = report; this.appliedStart = start; this.appliedEnd = end;
      this.chart = this.buildChart(report.daily || []);
    } catch (error: any) {
      if (id === this.requestId && !this.destroyed) { this.report = null; this.error = error.name === 'AbortError' ? 'La consulta tardó demasiado. Volvé a intentarlo.' : error.message || 'No se pudieron consultar los indicadores.'; }
    } finally {
      clearTimeout(timeout);
      if (id === this.requestId && !this.destroyed) { this.loading = false; this.cd.detectChanges(); }
    }
  }
  buildChart(rows: any[]) {
    rows = rows.map(row=>({...row,income:row.income ?? row.net_sales ?? (Number(row.sales||0)-Number(row.tax||0)),outflows:row.outflows ?? (Number(row.cost||0)+Number(row.cash_expenses||0)),profit:row.profit ?? row.estimated_margin ?? 0}));
    const definitions = [{key:'income',label:'Ingresos',color:'#08755f'},{key:'outflows',label:'Salidas: costos y gastos',color:'#c55735'},{key:'profit',label:'Utilidad estimada',color:'#396ccb'}];
    const values = rows.flatMap(row => definitions.map(series => Number(row[series.key] || 0)));
    const min = Math.min(0,...values), max = Math.max(0,...values), padding = (max-min || 10)*0.1;
    const low = min-padding, high = max+padding;
    const y = (value: number) => 210-(value-low)/(high-low)*180;
    const x = (index: number) => rows.length < 2 ? 494 : 134+index/(rows.length-1)*720;
    const indexes = [...new Set([0,Math.floor((rows.length-1)/4),Math.floor((rows.length-1)/2),Math.floor((rows.length-1)*3/4),rows.length-1])].filter(index => index >= 0 && index < rows.length);
    return {
      zero:y(0),
      ticks:Array.from({length:5},(_,i)=>({value:low+(high-low)*i/4,y:y(low+(high-low)*i/4)})),
      dates:indexes.map(i=>({x:x(i),label:rows[i].date.slice(5).split('-').reverse().join('/')})),
      series:definitions.map(series=>({...series,points:rows.map((row,i)=>`${x(i)},${y(Number(row[series.key] || 0))}`).join(' '),dots:rows.length<=45?rows.map((row,i)=>({x:x(i),y:y(Number(row[series.key] || 0)),label:`${this.dayLabel(row.date)} · ${series.label}: ${this.money(row[series.key])}`})):[]})),
    };
  }
}
