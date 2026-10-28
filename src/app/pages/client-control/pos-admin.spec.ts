import {describe,it,expect,vi,afterEach} from 'vitest';
import {PosAdmin} from './pos-admin';
afterEach(()=>vi.unstubAllGlobals());
function setup(){const c=new PosAdmin({detectChanges(){}} as any);c.adminData={accounts:[{email:'owner@example.test',active:false,business_ids:[4]}]};return c;}
describe('Eliminación de locales desde CEO',()=>{
 it('no elimina al cancelar',async()=>{const c=setup();vi.stubGlobal('confirm',()=>false);const request=vi.spyOn(c,'request');await c.deleteBusiness({id:4,name:'Salón'});expect(request).not.toHaveBeenCalled();});
 it('borra el ID confirmado y actualiza la lista',async()=>{const c=setup();vi.stubGlobal('confirm',()=>true);c.businessEdit=4;c.access={id:7};const request=vi.spyOn(c,'request').mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({accounts:[],businesses:[]});await c.deleteBusiness({id:4,name:'Salón'});expect(request).toHaveBeenNthCalledWith(1,'/admin/businesses/4','DELETE');expect(c.businessEdit).toBe(0);expect(c.access).toBeNull();expect(c.notice).toContain('conservaron');});
 it('muestra el rechazo del servidor sin anunciar eliminación',async()=>{const c=setup();vi.stubGlobal('confirm',()=>true);vi.spyOn(c,'request').mockRejectedValue(Error('Tiene cuentas por cobrar'));await c.deleteBusiness({id:4,name:'Salón'});expect(c.error).toContain('cuentas por cobrar');expect(c.notice).toBe('');});
 it('distingue suspensión de cuenta y asociación del local',()=>{expect(setup().ownersFor({id:4})).toContain('cuenta suspendida');expect(setup().ownersFor({id:8})).toContain('Sin cuenta');});
});
