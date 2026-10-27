import {describe,it,expect,vi,afterEach} from 'vitest';
import {PosZenit} from './pos-zenit';
afterEach(()=>vi.unstubAllGlobals());
describe('Compatibility with Zénit reservation replies',()=>{
 function setup(){const c=new PosZenit({markForCheck(){}} as any);c.api='https://example.test';c.businessId=1;c.edit({id:'booking-id',customerId:'registered-client',status:'CONFIRMED',startAt:'2027-01-10T15:00:00Z',endAt:'2027-01-10T16:00:00Z'});c.change.status='CANCELLED';return c;}
 it('sends the reason and proposal without overriding the original appointment time',async()=>{
  const c=setup();c.change.responseMessage='Otro horario';c.change.proposedDate='2027-01-10';c.change.proposedTime='11:00';c.change.date='2027-01-11';c.change.time='14:00';
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({appointment:{}})}).mockResolvedValueOnce({ok:true,json:async()=>({appointments:[]})});vi.stubGlobal('fetch',fetch);
  await c.updateAppointment();const body=JSON.parse(fetch.mock.calls[0][1].body);expect(body.responseMessage).toBe('Otro horario');expect(body.proposedDate).toBe('2027-01-10');expect(body.proposedTime).toBe('11:00');expect(body.date).toBeUndefined();expect(body.time).toBeUndefined();
 });
 it('requires a reason for a registered client before calling the server',async()=>{const c=setup();const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await c.updateAppointment();expect(fetch).not.toHaveBeenCalled();expect(c.error).toContain('motivo');});
 it('requires both proposal fields before calling the server',async()=>{const c=setup();c.change.responseMessage='Otro horario';c.change.proposedDate='2027-01-10';const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await c.updateAppointment();expect(fetch).not.toHaveBeenCalled();expect(c.error).toContain('fecha y hora');});
});
