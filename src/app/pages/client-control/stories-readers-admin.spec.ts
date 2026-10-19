import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {StoriesReadersAdmin} from './stories-readers-admin';

const item={id:1,full_name:'Lector de prueba',email:'reader@example.com',phone:'88888888',is_active:true,created_at:'2026-10-19T12:00:00Z',last_login_at:null};
describe('Clientes Stories en el panel',()=>{
 let http:HttpTestingController;
 beforeEach(async()=>{
   sessionStorage.clear();
   await TestBed.configureTestingModule({imports:[StoriesReadersAdmin],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();
   http=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>{http.verify();sessionStorage.clear();});
 function create(){const f=TestBed.createComponent(StoriesReadersAdmin);f.componentRef.setInput('apiBase','http://test-api');f.detectChanges();return f;}
 it('sin sesión pide la cuenta administradora y no consulta datos',()=>{
  const f=create();expect(f.nativeElement.textContent).toContain('Acceso administrativo');http.expectNone(r=>r.url.includes('/admin/readers'));
 });
 it('muestra total global y paginación y busca desde la primera página',()=>{
  sessionStorage.setItem('systemlab-pos-token','admin-token');const f=create();
  const r=http.expectOne(req=>req.url.endsWith('/admin/readers'));expect(r.request.headers.get('Authorization')).toBe('Bearer admin-token');
  r.flush({total:31,filtered_total:31,items:[item]});f.detectChanges();expect(f.nativeElement.textContent).toContain('31');expect(f.nativeElement.textContent).toContain(item.email);
  f.componentInstance.next();const next=http.expectOne(req=>req.params.get('offset')==='25');next.flush({total:31,filtered_total:31,items:[item]});
  f.componentInstance.search='Lector';f.componentInstance.filter();const filter=http.expectOne(req=>req.params.get('q')==='Lector');expect(filter.request.params.get('offset')).toBe('0');filter.flush({total:31,filtered_total:1,items:[item]});
 });
 it('una sesión sin permisos no deja datos visibles',()=>{
  sessionStorage.setItem('systemlab-pos-token','client-token');const f=create();http.expectOne(r=>r.url.endsWith('/admin/readers')).flush({detail:'Solo CEO'},{status:403,statusText:'Forbidden'});f.detectChanges();
  expect(f.componentInstance.data()).toBeNull();expect(f.nativeElement.textContent).toContain('cuenta administradora');expect(f.nativeElement.querySelector('.reader')).toBeNull();
 });
 it('login reutiliza la sesión POS solo para una cuenta CEO',()=>{
  const f=create();const c=f.componentInstance;c.email='admin@example.com';c.password='password';c.login();
  http.expectOne('http://test-api/pos-api/auth/login').flush({token:'ceo-session',account:{ceo:true}});
  expect(sessionStorage.getItem('systemlab-pos-token')).toBe('ceo-session');expect(c.password).toBe('');
  http.expectOne(r=>r.url.endsWith('/admin/readers')).flush({total:0,filtered_total:0,items:[]});f.detectChanges();expect(f.nativeElement.textContent).toContain('Todavía no hay lectores');
 });
 it('no guarda una sesión de cliente como si fuera administradora',()=>{
  const f=create();const c=f.componentInstance;c.email='client@example.com';c.password='password';c.login();http.expectOne('http://test-api/pos-api/auth/login').flush({token:'client-session',account:{ceo:false}});
  expect(sessionStorage.getItem('systemlab-pos-token')).toBeNull();expect(c.data()).toBeNull();
 });
 it('puede reintentar un fallo de red',()=>{
  sessionStorage.setItem('systemlab-pos-token','admin-token');const f=create();http.expectOne(r=>r.url.endsWith('/admin/readers')).flush('error',{status:503,statusText:'Unavailable'});
  expect(f.componentInstance.loading()).toBe(false);f.componentInstance.refresh();http.expectOne(r=>r.url.endsWith('/admin/readers')).flush({total:1,filtered_total:1,items:[item]});expect(f.componentInstance.data()?.total).toBe(1);
 });
});
