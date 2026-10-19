import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap} from '@angular/router';
import {of, Subject, throwError} from 'rxjs';
import {StoriesAuthService} from '../../services/stories-auth.service';
import {StoriesRecovery} from './stories-recovery';
describe('Recuperación de contraseña Stories',()=>{
 const auth={forgotPassword:vi.fn(),resetPassword:vi.fn(),logout:vi.fn()};const navigate=vi.fn();
 beforeEach(async()=>{
  vi.resetAllMocks();navigate.mockResolvedValue(true);
  await TestBed.configureTestingModule({imports:[StoriesRecovery],providers:[{provide:StoriesAuthService,useValue:auth},{provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({})}}},{provide:Router,useValue:{navigate}}]}).compileComponents();
 });
 it('envía el correo y evita solicitudes duplicadas mientras espera',()=>{
  auth.forgotPassword.mockReturnValue(new Subject());const f=TestBed.createComponent(StoriesRecovery);f.detectChanges();const c=f.componentInstance;c.show();c.email=' reader@example.com ';c.submit();c.submit();expect(auth.forgotPassword).toHaveBeenCalledExactlyOnceWith('reader@example.com');expect(c.busy()).toBe(true);
 });
 it('captura el token y lo retira de la URL',()=>{
  (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap=convertToParamMap({reset:'opaque-token'});
  const f=TestBed.createComponent(StoriesRecovery);f.detectChanges();expect(f.componentInstance.resetting()).toBe(true);expect(navigate).toHaveBeenCalled();
 });
 it('valida confirmación y termina en inicio de sesión con la contraseña nueva',()=>{
  (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap=convertToParamMap({reset:'opaque-token'});
  const f=TestBed.createComponent(StoriesRecovery);f.detectChanges();const c=f.componentInstance;c.password='NewPassword1';c.confirmation='incorrecta';c.submit();expect(auth.resetPassword).not.toHaveBeenCalled();
  auth.resetPassword.mockReturnValue(of({message:'Contraseña actualizada'}));c.confirmation=c.password;c.submit();expect(auth.resetPassword).toHaveBeenCalledWith('opaque-token','NewPassword1');expect(auth.logout).toHaveBeenCalled();expect(c.password).toBe('');expect(c.message()).toContain('actualizada');
 });
 it('muestra error de enlace vencido y permite solicitar otro',()=>{
  (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap=convertToParamMap({reset:'expired'});auth.resetPassword.mockReturnValue(throwError(()=>({error:{detail:'Enlace vencido'}})));
  const f=TestBed.createComponent(StoriesRecovery);f.detectChanges();const c=f.componentInstance;c.password='NewPassword1';c.confirmation=c.password;c.submit();expect(c.error()).toBe('Enlace vencido');expect(c.busy()).toBe(false);c.requestNew();expect(c.resetting()).toBe(false);
 });
 it('informa cuando el servicio SMTP aún no está configurado',()=>{
  auth.forgotPassword.mockReturnValue(throwError(()=>({error:{detail:'Recuperación no disponible'}})));const f=TestBed.createComponent(StoriesRecovery);f.detectChanges();const c=f.componentInstance;c.email='reader@example.com';c.submit();expect(c.error()).toContain('no disponible');
 });
});
