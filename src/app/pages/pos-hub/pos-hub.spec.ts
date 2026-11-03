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
  it('muestra varias cuentas en una mesa y conserva la ocupación al pagar una',async()=>{
    component.data.business.tables=3;component.tab='dashboard';
    component.data.orders=[{id:10,label:'Ana',table_number:2,table_session:'visit-1',status:'open',items:[],total:6000},{id:11,label:'Luis',table_number:2,table_session:'visit-1',status:'open',items:[],total:11000}];
    component.useTable(2);render();await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.table-bill').length).toBe(2);expect(component.tableBalance(2)).toBe(17000);
    component.data.orders[0].status='paid';expect(component.occupied(2)).toBe(true);expect(component.tableBalance(2)).toBe(11000);
    component.startTableAccount(2);expect(component.label).toBe('Mesa 2 · Cuenta 3');expect(component.tableSession).toBe('visit-1');
    component.data.orders[1].status='paid';expect(component.occupied(2)).toBe(false);
    component.useTable(2);expect(component.tableNumber).toBe(2);expect(component.tableSession).toBeNull();expect(component.editingOrder).toBe(0);
  });
  it('cobra el id de la cuenta seleccionada con su cliente y su revisión',async()=>{
    const bill={id:11,label:'Luis',revision:4,customer_id:null,table_number:2,status:'ready',total:11000,items:[]};
    const mutate=vi.spyOn(component,'mutate').mockResolvedValue({...bill,status:'paid',customer_id:8,loyalty_name:'Luis',loyalty_status:'credited',loyalty_points:7});
    vi.spyOn(component.printAgent,'printReceipt').mockResolvedValue({duplicate:false});
    component.openPayment(bill);component.method='sinpe';component.paymentCustomer={customer_id:null,loyalty_code:'A02',loyalty_name:'Luis'};
    await component.pay();
    expect(mutate).toHaveBeenCalledWith('/orders/11/pay',{method:'sinpe',received:11000,invoice_number:'',expected_revision:4,customer_id:null,loyalty_code:'A02'});
    expect(component.notice).toContain('7 puntos acreditados a Luis');expect(component.receipt.id).toBe(11);
  });
  it('las cuentas derivadas consultan la comanda original y no duplican cocina',()=>{
    const original={id:10,status:'split',kitchen_status:'preparing',items:[{name:'Pizza',quantity:1}]};
    const child={id:11,status:'open',preparation_order_id:10,split_parent_id:10,kitchen_status:null,items:[{name:'Pizza',quantity:.5}]};
    component.data.orders=[original,child];expect(component.kitchenOrders).toHaveLength(1);
    component.showComanda(child);expect(component.comanda).toBe(original);
    component.edit(child);expect(component.editingOrder).toBe(0);expect(component.tab).toBe('orders');
  });
});
