import {Component,Input,OnInit,OnChanges,ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {posRequest} from './pos-api-client';
@Component({selector:'app-pos-credit',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./pos-credit.html',styleUrl:'./pos-credit.scss'})
export class PosCredit implements OnInit,OnChanges{
 @Input()api='';@Input()businessId=0;@Input()orders:any[]=[];@Input()customers:any[]=[];
 constructor(private cd:ChangeDetectorRef){}
 data:any={accounts:[],balance:0,overdue:0};error='';busy=false;orderId=0;invoiceNumber='';plan:any[]=[{due:'',amount:0}];forms:Record<number,any>={};receipt:any=null;
 ngOnInit(){void this.load();}ngOnChanges(){if(this.businessId)void this.load();}
 get pending(){return this.orders.filter(o=>['open','queued','preparing','ready'].includes(o.status)&&o.customer_id);}
 money(v:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(+v);}
 customer(id:number){return this.customers.find(c=>c.id===id)?.name||`Cliente #${id}`;}
 date(v:string){return new Date(v).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'});}
 method(s:string){return ({cash:'Efectivo',card:'Tarjeta',sinpe:'SINPE',transfer:'Transferencia'} as any)[s]||s;}
 state(s:string){return ({pending:'Pendiente',partial:'Parcial',paid:'Pagado',overdue:'Vencido',voided:'Anulado'} as any)[s]||s;}
 path(p=''){return `/business/${this.businessId}${p}`;}
 async action(fn:()=>Promise<void>){if(this.busy)return;this.busy=true;this.error='';try{await fn();await this.load();}catch(e:any){this.error=e.message;}finally{this.busy=false;this.cd.markForCheck();}}
 async load(){try{this.data=await posRequest(this.api,this.path('/receivables'));for(const c of this.data.accounts)this.forms[c.id]??={amount:0,method:'cash',reference:'',key:crypto.randomUUID()};}catch(e:any){this.error=e.message;}finally{this.cd.markForCheck();}}
 async create(){await this.action(async()=>{await posRequest(this.api,this.path(`/orders/${this.orderId}/credit`),'POST',{installments:this.plan,invoice_number:this.invoiceNumber});this.orderId=0;this.invoiceNumber='';this.plan=[{due:'',amount:0}];});}
 async pay(c:any){const f=this.forms[c.id];await this.action(async()=>{this.receipt=await posRequest(this.api,this.path(`/receivables/${c.id}/payments`),'POST',{request_key:f.key,amount:f.amount,method:f.method,reference:f.reference});f.key=crypto.randomUUID();f.amount=0;});}
 async voidPayment(c:any,p:any){const reason=prompt('Motivo de anulación del abono (se registra en la caja abierta):');if(!reason)return;await this.action(async()=>{await posRequest(this.api,this.path(`/receivables/${c.id}/payments/${p.id}/void`),'POST',{reason});});}
 async voidCredit(c:any){const reason=prompt('Motivo de anulación de la venta a crédito:');if(!reason)return;await this.action(async()=>{await posRequest(this.api,this.path(`/receivables/${c.id}/void`),'POST',{reason});});}
 print(){
  const popup=window.open('','_blank','width=600,height=750');if(!popup){this.error='Permití la ventana de impresión.';return;}
  popup.document.title='Comprobante de abono';
  const p=this.receipt;
  const lines=['Comprobante de abono #'+p.id,'Negocio #'+this.businessId,'Cuenta #'+p.receivable_id,
   new Date(p.created_at).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'}),this.money(p.amount)+' · '+p.method,
   'Referencia: '+(p.reference||'Sin referencia'),'Operador #'+p.account_id+' · Caja #'+p.register_id,
   p.voided_at?'ANULADO: '+p.void_reason:'Pago registrado'];
  for(const line of lines){const el=popup.document.createElement('p');el.textContent=line;popup.document.body.appendChild(el);}
  popup.focus();popup.print();
 }
}
