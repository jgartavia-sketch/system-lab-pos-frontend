import {describe,it,expect,vi,afterEach} from 'vitest';
import {PosCredit} from './pos-credit';
afterEach(()=>vi.unstubAllGlobals());
describe('Credit collection retries',()=>{
 it('preserves the operation key after an uncertain response and rotates it only on success',async()=>{
  sessionStorage.setItem('systemlab-pos-token','test-session');
  const c=new PosCredit({markForCheck(){}} as any);c.api='https://example.test';c.businessId=3;
  c.forms[7]={amount:50,method:'cash',reference:'ref',key:'original-key'};
  const mock=vi.fn().mockRejectedValueOnce(new Error('timeout'));vi.stubGlobal('fetch',mock);
  await c.pay({id:7});expect(c.forms[7].key).toBe('original-key');
  mock.mockResolvedValueOnce({ok:true,json:async()=>({id:9,amount:50})}).mockResolvedValueOnce({ok:true,json:async()=>({accounts:[],balance:0,overdue:0})});
  await c.pay({id:7});expect(JSON.parse(mock.mock.calls[1][1].body).request_key).toBe('original-key');expect(c.forms[7].key).not.toBe('original-key');expect(c.receipt.id).toBe(9);
 });
});
