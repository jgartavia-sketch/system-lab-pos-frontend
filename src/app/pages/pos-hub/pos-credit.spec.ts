import {describe,it,expect,vi,afterEach} from 'vitest';
import {PosCredit} from './pos-credit';
afterEach(()=>vi.unstubAllGlobals());
describe('Credit collection retries',()=>{
 it('preserves the operation key after an uncertain response and rotates it only on success',async()=>{
  sessionStorage.setItem('systemlab-pos-token','test-session');
  const c=new PosCredit({markForCheck(){}} as any);c.api='https://example.test';c.businessId=3;
  c.hasRegister=true;
  c.forms[7]={amount:50,method:'cash',reference:'ref',key:'original-key'};
  const mock=vi.fn().mockRejectedValueOnce(new Error('timeout'));vi.stubGlobal('fetch',mock);
  await c.pay({id:7,balance:100});expect(c.forms[7].key).toBe('original-key');
  mock.mockResolvedValueOnce({ok:true,json:async()=>({id:9,amount:50})}).mockResolvedValueOnce({ok:true,json:async()=>({accounts:[],balance:0,overdue:0})});
  await c.pay({id:7,balance:100});expect(JSON.parse(mock.mock.calls[1][1].body).request_key).toBe('original-key');expect(c.forms[7].key).not.toBe('original-key');expect(c.receipt.id).toBe(9);
 });
 it('searches by customer and only shows outstanding accounts by default',()=>{
  const c=new PosCredit({markForCheck(){}} as any);
  c.customers=[{id:1,name:'Ana',phone:'8888-1111',email:'ana@example.test'},{id:2,name:'Luisa'}];
  c.data={accounts:[{id:1,customer_id:1,order_id:35,balance:2000,status:'partial',invoice_number:'POS-35'},{id:2,customer_id:2,order_id:36,balance:0,status:'paid'}]};
  expect(c.accounts).toHaveLength(1);c.query='8888';expect(c.accounts[0].id).toBe(1);
  c.query='Luisa';expect(c.accounts).toHaveLength(0);c.filter='all';expect(c.accounts[0].id).toBe(2);
 });
 it('does not send a payment with a closed drawer or an amount above the balance',async()=>{
  const c=new PosCredit({markForCheck(){}} as any);c.forms[1]={amount:100,method:'cash',key:'key'};
  const mock=vi.fn();vi.stubGlobal('fetch',mock);
  await c.pay({id:1,balance:200});expect(mock).not.toHaveBeenCalled();
  c.hasRegister=true;c.forms[1].amount=201;await c.pay({id:1,balance:200});expect(mock).not.toHaveBeenCalled();
  c.forms[1].amount=200;expect(c.validPayment({id:1,balance:200})).toBe(true);
 });
});
