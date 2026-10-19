import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {provideRouter,ActivatedRoute,convertToParamMap} from '@angular/router';
import {ClientControl} from './client-control';
import {StoriesReadersAdmin} from './stories-readers-admin';
const paid={id:1,client_id:1,product_service:'Mensualidad',value:25000,currency:'CRC',status:'paid',period_start:null,period_end:null,due_date:null,payment_date:'2026-10-19',next_payment_date:null,detail:null};
const pending={...paid,id:2,status:'pending',product_service:'Pendiente'};
const milestone={id:1,client_id:1,title:'Tarea',description:null,status:'pending',priority:'medium',due_date:null};
const client={id:1,name:'Empresa',slug:'empresa',website_url:null,is_active:true,service_statuses:[],milestones:[milestone],payments:[paid,pending]};
describe('Controles de tareas y pagos',()=>{
 let http:HttpTestingController;
 beforeEach(async()=>{sessionStorage.clear();await TestBed.configureTestingModule({imports:[ClientControl],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({})}}}]}).compileComponents();http=TestBed.inject(HttpTestingController);});
 afterEach(()=>{http.verify();vi.restoreAllMocks();});
 function create(){const f=TestBed.createComponent(ClientControl);f.detectChanges();http.expectOne(r=>r.url.endsWith('/client-management/dashboard')).flush({services:[],clients:[client]});f.detectChanges();return f;}
 it('las tarjetas filtran pagos completos sin cambiar el total de cada grupo',()=>{
  const f=create();const c=f.componentInstance as any;c.setTab('payments');f.detectChanges();const cards=f.nativeElement.querySelectorAll('.finance-card');cards[3].click();f.detectChanges();expect(c.paymentsForClient(client).map((x:any)=>x.id)).toEqual([1]);expect(c.paymentsByStage('pending').length).toBe(1);expect(f.nativeElement.querySelector('.payment-client-card').open).toBe(true);cards[3].click();expect(c.paymentFilter()).toBeNull();
 });
 it('marca la tarea completada y actualiza la lista',()=>{
  const f=create();const c=f.componentInstance as any;c.updateMilestoneStatus(milestone,'completed');const r=http.expectOne(r=>r.url.endsWith('/milestones/1'));expect(r.request.body.status).toBe('completed');r.flush({...milestone,status:'completed'});expect(c.dashboard().clients[0].milestones[0].status).toBe('completed');
 });
 it('cancelar eliminación no envía nada',()=>{
  const f=create();sessionStorage.setItem('systemlab-pos-token','ceo');vi.spyOn(globalThis,'confirm').mockReturnValue(false);(f.componentInstance as any).deleteRecord('payment',1,'Mensualidad');http.expectNone(r=>r.method==='DELETE');
 });
 it('elimina solo el pago elegido y envía sesión administrativa',()=>{
  const f=create();sessionStorage.setItem('systemlab-pos-token','ceo');vi.spyOn(globalThis,'confirm').mockReturnValue(true);const c=f.componentInstance as any;c.deleteRecord('payment',1,'Mensualidad');const r=http.expectOne(r=>r.url.endsWith('/payments/1'));expect(r.request.headers.get('Authorization')).toBe('Bearer ceo');r.flush(null,{status:204,statusText:'No Content'});expect(c.dashboard().clients[0].payments.map((x:any)=>x.id)).toEqual([2]);expect(c.dashboard().clients[0].milestones.length).toBe(1);
 });
 it('un rechazo conserva la tarea',()=>{
  const f=create();sessionStorage.setItem('systemlab-pos-token','client');vi.spyOn(globalThis,'confirm').mockReturnValue(true);const c=f.componentInstance as any;c.deleteRecord('milestone',1,'Tarea');http.expectOne(r=>r.url.endsWith('/milestones/1')).flush({}, {status:403,statusText:'Forbidden'});expect(c.dashboard().clients[0].milestones.length).toBe(1);expect(c.deletingIds().size).toBe(0);
 });
});
describe('Eliminar lectores desde el panel',()=>{
 let http:HttpTestingController;
 beforeEach(async()=>{sessionStorage.setItem('systemlab-pos-token','ceo');await TestBed.configureTestingModule({imports:[StoriesReadersAdmin],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();http=TestBed.inject(HttpTestingController);});
 afterEach(()=>{http.verify();vi.restoreAllMocks();sessionStorage.clear();});
 it('confirma y actualiza el total tras borrar',()=>{
  const f=TestBed.createComponent(StoriesReadersAdmin);f.componentRef.setInput('apiBase','http://test-api');f.detectChanges();const reader={id:1,full_name:'Lector',email:'reader@example.com',phone:'88888888',is_active:true,created_at:'2026-10-19',last_login_at:null};http.expectOne(r=>r.url.endsWith('/admin/readers')).flush({total:1,filtered_total:1,items:[reader]});vi.spyOn(globalThis,'confirm').mockReturnValue(true);f.componentInstance.deleteReader(reader);http.expectOne('http://test-api/stories/admin/readers/1').flush(null,{status:204,statusText:'No Content'});http.expectOne(r=>r.url.endsWith('/admin/readers')).flush({total:0,filtered_total:0,items:[]});expect(f.componentInstance.data()?.total).toBe(0);
 });
});
