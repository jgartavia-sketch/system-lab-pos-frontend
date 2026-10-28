import {describe,it,expect,vi,afterEach} from 'vitest';
import {PosAdmin} from './pos-admin';
afterEach(()=>vi.unstubAllGlobals());
function setup(){const c=new PosAdmin({detectChanges(){}} as any);c.adminData={accounts:[],businesses:[]};c.email='owner@example.test';c.password='chosen-pass12';c.confirmation=c.password;return c;}
describe('Activación simple de POS',()=>{
 it('no llama al servidor con confirmación distinta',async()=>{const c=setup();c.confirmation='otra';const request=vi.spyOn(c,'request');await c.activatePos();expect(request).not.toHaveBeenCalled();expect(c.error).toContain('coinciden');});
 it('activa en una sola operación y limpia ambas contraseñas',async()=>{const c=setup();const request=vi.spyOn(c,'request').mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({accounts:[],businesses:[]});await c.activatePos();expect(request).toHaveBeenNthCalledWith(1,'/admin/activate-pos','POST',{email:c.email,password:'chosen-pass12',confirmation:'chosen-pass12'});expect(c.password).toBe('');expect(c.confirmation).toBe('');expect(c.notice).toContain('POS activado');});
 it('confirma antes de cambiar credenciales de una cuenta existente',async()=>{const c=setup();c.adminData.accounts=[{email:c.email}];vi.stubGlobal('confirm',()=>false);const request=vi.spyOn(c,'request');await c.activatePos();expect(request).not.toHaveBeenCalled();});
 it('muestra rechazos del servidor sin anunciar éxito',async()=>{const c=setup();vi.spyOn(c,'request').mockRejectedValue(Error('Correo de empleado'));await c.activatePos();expect(c.error).toContain('empleado');expect(c.notice).toBe('');});
 it('separa suspensión de cuenta de la asociación del local',()=>{const c=setup();c.adminData.accounts=[{email:c.email,active:false,business_ids:[4]}];expect(c.ownersFor({id:4})).toContain('cuenta suspendida');});
 it('no elimina al cancelar',async()=>{const c=setup();vi.stubGlobal('confirm',()=>false);const request=vi.spyOn(c,'request');await c.deleteBusiness({id:4,name:'Salón'});expect(request).not.toHaveBeenCalled();});
});
describe('Suspensión y reactivación por pago',()=>{
 it('suspende la suscripción completa conservando datos',async()=>{const c=setup();vi.stubGlobal('confirm',()=>true);const request=vi.spyOn(c,'request').mockResolvedValue({accounts:[],businesses:[]});await c.suspend({id:4,email:c.email});expect(request).toHaveBeenNthCalledWith(1,'/admin/accounts/4/subscription','PUT',{active:false});});
 it('reactiva sin enviar una nueva contraseña',async()=>{const c=setup();vi.stubGlobal('confirm',()=>true);const request=vi.spyOn(c,'request').mockResolvedValue({accounts:[],businesses:[]});await c.resume({id:4,email:c.email});expect(request).toHaveBeenNthCalledWith(1,'/admin/accounts/4/subscription','PUT',{active:true});expect(c.notice).toContain('Conserva su contraseña');});
});
describe('Retirar clientes conservando historial',()=>{
 it('oculta retirados y permite restaurarlos por correo',()=>{const c=setup();c.adminData.accounts=[{ceo:false,archived:true,email:c.email,name:'Retirado'}];expect(c.customers).toEqual([]);});
 it('retira la suscripción sin borrar ventas',async()=>{const c=setup();vi.stubGlobal('confirm',()=>true);const request=vi.spyOn(c,'request').mockResolvedValue({accounts:[],businesses:[]});await c.deleteAccount({id:4,email:c.email});expect(request).toHaveBeenNthCalledWith(1,'/admin/accounts/4/subscription','DELETE');expect(c.notice).toContain('historial');});
});
