import { ChangeDetectorRef } from '@angular/core';
import { PosDashboard } from './pos-dashboard';

describe('Panel de indicadores', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('representa un solo día y resultados negativos sin coordenadas inválidas', () => {
    const dashboard = new PosDashboard({detectChanges:()=>{}} as ChangeDetectorRef);
    const chart = dashboard.buildChart([{date:'2026-09-09',gross_profit:0,estimated_margin:-500}]);
    expect(chart.series.map((line:any)=>line.key)).toEqual(['income','outflows','profit']);
    expect(chart.series[2].dots[0].y).toBeGreaterThan(chart.zero);
    expect(chart.series[0].dots[0].x).toBe(494);
    expect(chart.series[1].points).not.toMatch(/NaN|Infinity/);
    expect(dashboard.buildChart([]).series[0].points).toBe('');
  });
  it('ignora una respuesta atrasada de otro local', async () => {
    let resolveFirst!: (value:any)=>void;
    const fetchMock=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve;})).mockResolvedValueOnce({ok:true,json:async()=>({sales:200,daily:[]})});
    vi.stubGlobal('fetch',fetchMock);
    const dashboard = new PosDashboard({detectChanges:()=>{}} as ChangeDetectorRef);
    dashboard.api='https://example.com/pos-api';dashboard.businessId=1;
    const first=dashboard.fetchReport('2026-09-01','2026-09-09');
    dashboard.businessId=2;
    await dashboard.fetchReport('2026-09-01','2026-09-09');
    resolveFirst({ok:true,json:async()=>({sales:100,daily:[]})});await first;
    expect(dashboard.report.sales).toBe(200);
    dashboard.ngOnDestroy();
  });
});
