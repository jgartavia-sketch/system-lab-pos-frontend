import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PosHub } from './pos-hub';
import { groupOrderDays } from './pos-order-groups';

describe('Interacciones del POS', () => {
  let fixture: ComponentFixture<PosHub>;
  let component: PosHub;
  function render() { fixture.changeDetectorRef.markForCheck(); fixture.detectChanges(); }
  const product = {id:1,name:'Refresco',price:1500,tax_rate:13,stock:20,minimum:0,active:true,track_stock:true,category:'Bebidas',sku:'REF'};
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({imports:[PosHub],providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({mode:'restaurante'}))}}]}).compileComponents();
    fixture = TestBed.createComponent(PosHub); component = fixture.componentInstance;
    render(); await fixture.whenStable();
    component.account = {id:2,name:'Dueño',email:'owner@example.com',ceo:false}; component.bid=1;
    component.data = {business:{id:1,name:'Restaurante',tables:0},permissions:{role:'owner',sell:true,pay:true,cash:true,team:true,manage:false},products:[product],customers:[],orders:[],register:{id:1},movements:[],appointments:[],registers:[]};
  });
  afterEach(() => { fixture.destroy(); vi.restoreAllMocks(); });
  it('los botones visibles de cantidad suman y restan una unidad', async () => {
    component.tab='sale'; component.add(product); render(); await fixture.whenStable();
    const plus = fixture.nativeElement.querySelector('button[aria-label="Sumar una unidad de Refresco"]') as HTMLButtonElement;
    plus.click(); render(); await fixture.whenStable();
    plus.click(); render(); await fixture.whenStable();
    expect(component.cart[0].quantity).toBe(3);
    expect((fixture.nativeElement.querySelector('#quantity-1') as HTMLInputElement).value).toBe('3');
    const minus = fixture.nativeElement.querySelector('button[aria-label="Restar una unidad de Refresco"]') as HTMLButtonElement;
    minus.click(); render(); await fixture.whenStable();
    expect(component.cart[0].quantity).toBe(2);
    expect(fixture.nativeElement.querySelector('.quantity-field label').textContent).toContain('Cantidad');
  });
  it('abre hoy, mantiene días separados y conserva la elección al actualizar pedidos', async () => {
    vi.spyOn(component,'today').mockReturnValue('2026-09-09');
    const orders=[{id:1,created_at:'2026-09-08T15:00:00Z',status:'paid',items:[],total:100},{id:2,created_at:'2026-09-09T15:00:00Z',status:'open',items:[],total:200}];
    component.tab='orders';component.data.orders=orders;component.orderDays=groupOrderDays(orders);render();await fixture.whenStable();
    const groups=fixture.nativeElement.querySelectorAll('.day-accordion') as NodeListOf<HTMLDetailsElement>;
    expect(groups[0].open).toBe(true);expect(groups[1].open).toBe(false);
    expect(groups[0].textContent).toContain('#2');expect(groups[0].textContent).not.toContain('#1');
    groups[1].open=true;groups[1].dispatchEvent(new Event('toggle'));render();
    vi.spyOn(component,'request').mockResolvedValue({...component.data,orders:orders.map(o=>({...o,revision:2}))});
    await component.refresh();render();await fixture.whenStable();
    expect((fixture.nativeElement.querySelectorAll('.day-accordion')[1] as HTMLDetailsElement).open).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.day-accordion')[1].textContent).toContain('#1');
  });
  it('Mi cuenta del dueño no ofrece crear cuentas ni agregar locales', async () => {
    component.tab='account';render();await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('solicitá la autorización de System Lab');
    expect(fixture.nativeElement.querySelector('a.central-panel-link')).toBeNull();
    expect(fixture.nativeElement.querySelector('[name="businessName"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[name="ownerEmail"]')).toBeNull();
  });
  it('estima empaque para llevar y servicio en el local sin duplicarlos', () => {
    component.data.business.service_rate=10;
    component.data.products=[{...product,tax_rate:0,packaging_fee:400}];
    component.add(component.data.products[0]);component.add(component.data.products[0]);
    component.fulfillment='pickup';expect(component.packagingTotal).toBe(800);expect(component.serviceTotal).toBe(0);expect(component.estimatedTotal).toBe(3800);
    component.fulfillment='dine_in';expect(component.packagingTotal).toBe(0);expect(component.serviceTotal).toBe(300);expect(component.estimatedTotal).toBe(3300);
    component.resetCart();expect(component.sourceChannel).toBe('pos');expect(component.externalOrderId).toBe('');
  });
});
