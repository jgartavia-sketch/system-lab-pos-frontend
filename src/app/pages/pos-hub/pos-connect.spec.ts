import { ChangeDetectorRef } from '@angular/core';
import { PosConnect } from './pos-connect';
import { PosFinances } from './pos-finances';

const cd={detectChanges:()=>{}} as ChangeDetectorRef;
const response=(data:any)=>({ok:true,json:async()=>data});

describe('Finanzas y SL Connect',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('conserva el borrador cuando cambia el estado de caja',()=>{
    const component=new PosFinances(cd);component.draft.reason='Compra de ingredientes';component.draft.amount=24000;component.draft.from_register=true;component.hasRegister=false;
    component.ngOnChanges({hasRegister:{}});
    expect(component.draft.reason).toBe('Compra de ingredientes');expect(component.draft.amount).toBe(24000);expect(component.draft.from_register).toBe(false);
  });
  it('reintenta el mismo movimiento sin generar otra clave',async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce({ok:false,json:async()=>({detail:'Conexión interrumpida'})}).mockResolvedValueOnce(response({id:9})).mockResolvedValueOnce(response({entries:[]}));vi.stubGlobal('fetch',fetchMock);
    const component=new PosFinances(cd);component.businessId=1;component.api='https://example.com/pos-api';component.draft.amount=100;component.draft.category='Servicios';component.draft.reason='Electricidad';
    const originalKey=component.draft.request_key;
    await component.save();expect(component.draft.request_key).toBe(originalKey);
    await component.save();
    const writes=fetchMock.mock.calls.filter((args:any[])=>args[1].method==='POST');
    expect(writes).toHaveLength(2);expect(JSON.parse(writes[0][1].body).request_key).toBe(JSON.parse(writes[1][1].body).request_key);
    expect(component.draft.request_key).not.toBe(originalKey);
  });
  it('ignora los clientes de un local consultado antes de cambiar de local',async()=>{
    let firstResolve!:(result:any)=>void;
    const fetchMock=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>firstResolve=resolve)).mockResolvedValueOnce(response({customers:[{name:'Local nuevo'}],total:1}));vi.stubGlobal('fetch',fetchMock);
    const component=new PosConnect(cd);component.businessId=1;component.api='https://example.com/pos-api';
    const first=component.loadCustomers();component.businessId=2;
    vi.spyOn(component,'loadSummary').mockResolvedValue();component.ngOnChanges({businessId:{}});
    await new Promise(resolve=>setTimeout(resolve,0));
    firstResolve(response({customers:[{name:'Local anterior'}],total:1}));await first;
    expect(component.customers.map(c=>c.name)).toEqual(['Local nuevo']);component.ngOnDestroy();
  });
  it('bloquea un segundo clic mientras se registra un ajuste de puntos',async()=>{
    let complete!:(result:any)=>void;const fetchMock=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>complete=resolve));vi.stubGlobal('fetch',fetchMock);
    const component=new PosConnect(cd);component.businessId=1;component.editing={code:'A01',points:20};component.adjustment.reason='Recompensa';
    vi.spyOn(component,'loadCustomers').mockResolvedValue();vi.spyOn(component,'loadSummary').mockResolvedValue();
    const first=component.savePoints();await component.savePoints();expect(fetchMock).toHaveBeenCalledTimes(1);
    complete(response({points:21}));await first;expect(component.editing).toBeNull();
  });
});
