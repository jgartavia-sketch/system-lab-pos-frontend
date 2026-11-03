import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosCustomerPicker } from './pos-customer-picker';

describe('Cliente y fidelización de cada cuenta',()=>{
  let fixture:ComponentFixture<PosCustomerPicker>;let component:PosCustomerPicker;
  function render(){fixture.changeDetectorRef.markForCheck();fixture.detectChanges();}
  beforeEach(async()=>{
    sessionStorage.setItem('systemlab-pos-token','cashier-test');
    await TestBed.configureTestingModule({imports:[PosCustomerPicker]}).compileComponents();
    fixture=TestBed.createComponent(PosCustomerPicker);component=fixture.componentInstance;
    fixture.componentRef.setInput('api','https://example.test/pos-api');fixture.componentRef.setInput('businessId',1);fixture.componentRef.setInput('loyalty',true);render();
  });
  afterEach(()=>{fixture.destroy();vi.restoreAllMocks();vi.unstubAllGlobals();sessionStorage.clear();});
  it('exige seleccionar el registro encontrado antes de asignarlo a la cuenta',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({customers:[{code:'A02',name:'Luis',whatsapp:'88888888',points:7}]}))));
    const emit=vi.spyOn(component.selectedChange,'emit');component.query='88888888';await component.search();render();
    expect(emit).not.toHaveBeenCalled();
    const result=fixture.nativeElement.querySelector('.customer-results button') as HTMLButtonElement;result.click();
    expect(emit).toHaveBeenCalledWith({customer_id:null,loyalty_code:'A02',loyalty_name:'Luis'});
    const options=(fetch as any).mock.calls[0][1];expect(options.headers.Authorization).toBe('Bearer cashier-test');
  });
  it('reutiliza el vínculo exacto del cliente registrado sin confundir nombres repetidos',()=>{
    component.customers=[{id:1,name:'Ana',remote_id:'A01'},{id:2,name:'Ana',remote_id:'A02'}];
    const emit=vi.spyOn(component.selectedChange,'emit');component.select({code:'A02',name:'Ana'});
    expect(emit).toHaveBeenCalledWith({customer_id:2,loyalty_code:'A02',loyalty_name:'Ana'});
    component.clear();expect(emit).toHaveBeenLastCalledWith({customer_id:null,loyalty_code:null});
  });
  it('no muestra búsquedas de un proveedor para negocios sin esa conexión',()=>{
    fixture.componentRef.setInput('loyalty',false);render();
    expect(fixture.nativeElement.querySelector('.search-row')).toBeNull();
  });
});
