import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosSplitBill } from './pos-split-bill';

describe('Separación de cuentas de una mesa',()=>{
  let fixture:ComponentFixture<PosSplitBill>;let component:PosSplitBill;
  const source={id:40,revision:7,table_number:3,total:11000,items:[{name:'Pizza compartida',quantity:1,subtotal:10000}]};
  function render(){fixture.changeDetectorRef.markForCheck();fixture.detectChanges();}
  beforeEach(async()=>{
    sessionStorage.setItem('systemlab-pos-token','test-token');
    await TestBed.configureTestingModule({imports:[PosSplitBill]}).compileComponents();
    fixture=TestBed.createComponent(PosSplitBill);component=fixture.componentInstance;
    fixture.componentRef.setInput('order',structuredClone(source));fixture.componentRef.setInput('businessId',2);fixture.componentRef.setInput('api','https://example.test/pos-api');render();
  });
  afterEach(()=>{fixture.destroy();vi.restoreAllMocks();sessionStorage.clear();});
  it('distribuye un producto compartido y bloquea cantidades sobrantes o incompletas',async()=>{
    expect(component.valid).toBe(false);
    const button=[...fixture.nativeElement.querySelectorAll('button')].find((b:any)=>b.textContent.includes('Repartir todo por igual')) as HTMLButtonElement;
    button.click();render();await fixture.whenStable();
    expect(component.accounts.map(a=>a.quantities[0])).toEqual([.5,.5]);expect(component.valid).toBe(true);
    const input=fixture.nativeElement.querySelector('input[aria-label="Pizza compartida para Cuenta 1"]') as HTMLInputElement;
    input.value='.8';input.dispatchEvent(new Event('input'));render();await fixture.whenStable();
    expect(component.remaining(0)).toBe(-.3);expect(component.valid).toBe(false);
    expect(fixture.nativeElement.querySelector('.review').disabled).toBe(true);
  });
  it('conserva cantidades exactas al compartir entre tres y al quitar una cuenta',()=>{
    component.addAccount();component.distributeAll();
    expect(component.accounts.map(a=>a.quantities[0])).toEqual([.334,.333,.333]);expect(component.remaining(0)).toBe(0);
    component.removeAccount();expect(component.accounts.map(a=>a.quantities[0])).toEqual([.667,.333]);expect(component.valid).toBe(true);
  });
  it('envía cliente y revisión por cuenta y reintenta la misma distribución tras perder la respuesta',async()=>{
    component.distributeAll();component.accounts[1].customer={customer_id:null,loyalty_code:'A02',loyalty_name:'Luis'};
    const bodies:any[]=[];let confirmations=0;
    vi.stubGlobal('fetch',vi.fn(async(url:string,options:any)=>{
      const body=JSON.parse(options.body);bodies.push(body);
      if(url.endsWith('/preview'))return new Response(JSON.stringify({total:11000,accounts:[{label:'Cuenta 1',total:5500},{label:'Cuenta 2',total:5500}]}));
      confirmations++;if(confirmations===1)throw Error('Se perdió la respuesta');
      return new Response(JSON.stringify({accounts:[{id:41},{id:42}],replayed:true}));
    }));
    const completed=vi.spyOn(component.completed,'emit');await component.review();expect(component.preview).not.toBeNull();
    await component.confirm();expect(component.error).toContain('Se perdió');expect(completed).not.toHaveBeenCalled();
    await component.confirm();expect(completed).toHaveBeenCalledOnce();
    expect(bodies[0].expected_revision).toBe(7);expect(bodies[0].accounts[1].loyalty_code).toBe('A02');
    expect(bodies[1]).toEqual(bodies[2]);expect(bodies[1].request_key).toBe(bodies[0].request_key);
    vi.unstubAllGlobals();
  });
  it('invalida la revisión al cambiar la persona o el reparto',()=>{
    component.distributeAll();component.preview={accounts:[]};component.accounts[0].label='Ana';component.invalidate();
    expect(component.preview).toBeNull();
  });
});
