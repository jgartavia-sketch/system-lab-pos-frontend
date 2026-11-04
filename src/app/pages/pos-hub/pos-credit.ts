import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {posRequest} from './pos-api-client';

@Component({selector:'app-pos-credit',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./pos-credit.html',styleUrl:'./pos-credit.scss'})
export class PosCredit implements OnChanges, OnDestroy {
  @Input() api='';
  @Input() businessId=0;
  @Input() businessName='';
  @Input() customers:any[]=[];
  @Input() hasRegister=false;
  @Input() focusOrderId=0;
  @Output() changed=new EventEmitter<void>();
  constructor(private cd:ChangeDetectorRef){}
  data:any={accounts:[],balance:0,overdue:0};
  error='';notice='';busy=false;loading=false;query='';filter='pending';selectedId=0;
  forms:Record<number,any>={};receipt:any=null;receiptAccount:any=null;
  private loadVersion=0;private destroyed=false;
  ngOnChanges(changes:SimpleChanges){
    if(changes['businessId']){this.data={accounts:[],balance:0,overdue:0};this.forms={};this.selectedId=0;this.receipt=null;this.receiptAccount=null;}
    if(this.businessId&&(changes['businessId']||changes['focusOrderId']))void this.load(true);
  }
  ngOnDestroy(){this.destroyed=true;this.loadVersion++;}
  get accounts(){
    const q=this.query.trim().toLocaleLowerCase('es');
    return this.data.accounts.filter((c:any)=>{
      const match=this.filter==='all'||(this.filter==='pending'?c.status!=='voided'&&+c.balance>0:c.status===this.filter);
      const customer=this.customers.find(x=>x.id===c.customer_id);
      return match&&(!q||[this.customer(c),customer?.phone,customer?.email,c.order_id,c.invoice_number,c.order_label].join(' ').toLocaleLowerCase('es').includes(q));
    });
  }
  get selected(){return this.data.accounts.find((c:any)=>c.id===this.selectedId);}
  get pendingCount(){return this.data.accounts.filter((c:any)=>c.status!=='voided'&&+c.balance>0).length;}
  money(v:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(+v||0);}
  customer(c:any){return c.customer_name||this.customers.find(x=>x.id===c.customer_id)?.name||`Cliente #${c.customer_id}`;}
  date(v:string){return new Date(v.endsWith('Z')||/[+-]\d\d:\d\d$/.test(v)?v:v+'Z').toLocaleString('es-CR',{timeZone:'America/Costa_Rica'});}
  due(v:string|null){return v?v.split('-').reverse().join('/'):'Sin fecha límite';}
  method(s:string){return ({cash:'Efectivo',card:'Tarjeta',sinpe:'SINPE',transfer:'Transferencia'} as any)[s]||s;}
  state(s:string){return ({pending:'Pendiente',partial:'Con abonos',paid:'Saldada',overdue:'Vencida',voided:'Anulada'} as any)[s]||s;}
  path(p=''){return `/business/${this.businessId}${p}`;}
  validPayment(c:any){const amount=+this.forms[c.id]?.amount;return this.hasRegister&&Number.isFinite(amount)&&amount>0&&Math.round(amount*100)<=Math.round(+c.balance*100)&&Math.abs(amount*100-Math.round(amount*100))<.000001;}
  select(c:any){this.selectedId=c.id;this.receipt=null;this.notice='';this.error='';}
  async load(focus=false){
    const version=++this.loadVersion;this.loading=true;this.error='';
    try{
      const data=await posRequest(this.api,this.path('/receivables'));
      if(version!==this.loadVersion||this.destroyed)return;
      for(const c of data.accounts)this.forms[c.id]??={amount:0,method:'cash',reference:'',key:crypto.randomUUID()};
      this.data=data;
      if(focus&&this.focusOrderId){const c=data.accounts.find((a:any)=>a.order_id===this.focusOrderId);if(c){this.selectedId=c.id;this.filter='all';this.query='';}}
      if(this.receipt)this.receiptAccount=data.accounts.find((c:any)=>c.id===this.receipt.receivable_id)||this.receiptAccount;
    }catch(e:any){if(version===this.loadVersion)this.error=e.message;}
    finally{if(version===this.loadVersion&&!this.destroyed){this.loading=false;this.cd.markForCheck();}}
  }
  async action(fn:()=>Promise<void>){
    if(this.busy||this.loading)return;this.busy=true;this.error='';this.notice='';
    try{await fn();await this.load();this.changed.emit();}
    catch(e:any){this.error=e.message;}
    finally{this.busy=false;this.cd.markForCheck();}
  }
  async pay(c:any){
    if(!this.validPayment(c)){this.error='Abrí la caja e indicá un abono mayor que cero y menor o igual al saldo, con hasta dos decimales.';return;}
    const f=this.forms[c.id];
    await this.action(async()=>{
      this.receipt=await posRequest(this.api,this.path(`/receivables/${c.id}/payments`),'POST',{request_key:f.key,amount:+f.amount,method:f.method,reference:f.reference});
      this.receiptAccount=c;f.key=crypto.randomUUID();f.amount=0;f.reference='';
      this.notice='Abono registrado. El saldo se actualiza con este pago.';
    });
  }
  async voidPayment(c:any,p:any){
    const reason=prompt('Motivo de anulación del abono (se registra en la caja abierta):');if(!reason?.trim())return;
    await this.action(async()=>{await posRequest(this.api,this.path(`/receivables/${c.id}/payments/${p.id}/void`),'POST',{reason});this.receipt=null;this.notice='Abono anulado. Se conserva en el historial y su importe vuelve al saldo.';});
  }
  async voidCredit(c:any){
    const reason=prompt('Motivo de anulación de la venta a crédito:');if(!reason?.trim())return;
    await this.action(async()=>{await posRequest(this.api,this.path(`/receivables/${c.id}/void`),'POST',{reason});this.receipt=null;this.notice='Venta a crédito anulada.';});
  }
  showReceipt(c:any,p:any){this.receipt=p;this.receiptAccount=c;}
  print(){
    if(!this.receipt)return;
    const popup=window.open('','_blank','width=600,height=750');if(!popup){this.error='Permití la ventana de impresión.';return;}
    popup.document.title='Comprobante de abono';
    const p=this.receipt,c=this.receiptAccount;
    const lines=[this.businessName||'System Lab POS','Comprobante de abono #'+p.id,
      c?this.customer(c):'Cuenta #'+p.receivable_id,
      'Venta #'+(c?.order_id||'')+' · Referencia '+(c?.invoice_number||'Sin referencia'),
      this.date(p.created_at),this.money(p.amount)+' · '+this.method(p.method),
      'Referencia del abono: '+(p.reference||'Sin referencia'),
      'Saldo actual de la cuenta: '+this.money(c?.balance),
      p.voided_at?'ANULADO: '+p.void_reason:'Abono registrado',
      'Comprobante de control interno. No es una factura electrónica.'];
    for(const line of lines){const el=popup.document.createElement('p');el.textContent=line;popup.document.body.appendChild(el);}
    popup.focus();popup.print();
  }
}
