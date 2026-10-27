import {Component,Input,Output,EventEmitter,ChangeDetectorRef,OnInit,OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {posRequest} from './pos-api-client';
@Component({selector:'app-pos-zenit',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./pos-zenit.html',styleUrl:'./pos-zenit.scss'})
export class PosZenit implements OnInit,OnDestroy{
 @Input()api='';@Input()businessId=0;@Input()pending:any[]=[];
 @Output()changed=new EventEmitter<void>();@Output()imported=new EventEmitter<any>();
 day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Costa_Rica'}).format(new Date());busy=false;error='';notice='';loaded=false;
 appointments:any[]=[];products:any[]=[];services:any[]=[];orders:any[]=[];customers:any[]=[];importedIds:any={};section='orders';offset=0;nextOffset:number|null=null;private poll:any;
 booking:any=this.blankBooking();editId='';editingStatus='';editingCustomerId='';change:any={requestKey:crypto.randomUUID(),status:'',date:'',time:'',durationMinutes:60};
 constructor(private cd:ChangeDetectorRef){}
 blankBooking(){return {requestKey:crypto.randomUUID(),date:this.day,time:'',durationMinutes:60,customerName:'',phone:'',customerId:'',serviceSlug:'',notes:'',blocked:false};}
 ngOnInit(){void this.load();this.poll=setInterval(()=>{if(!this.busy&&!this.pending.length)void this.load(false);},30000);}
 ngOnDestroy(){clearInterval(this.poll);}
 base(path=''){return `/business/${this.businessId}/connect/zenit${path}`;}
 async action(fn:()=>Promise<void>){if(this.busy)return;this.busy=true;this.error='';this.notice='';try{await fn();}catch(e:any){this.error=e.message;}finally{this.busy=false;this.cd.markForCheck();}}
 async load(sync=true){await this.action(async()=>{
  if(sync&&!this.pending.length){await posRequest(this.api,this.base('/sync'),'POST',{});this.changed.emit();}
  const [agenda,catalog,orders,customers]=await Promise.all([posRequest(this.api,this.base('/appointments?date='+this.day)),posRequest(this.api,this.base('/catalog')),posRequest(this.api,this.base('/orders?offset='+this.offset)),posRequest(this.api,`/business/${this.businessId}/state`)]);
  this.appointments=agenda.appointments;this.products=catalog.products;this.services=catalog.services;this.orders=orders.orders;this.importedIds=orders.imported;this.nextOffset=orders.nextOffset;this.customers=customers.customers.filter((c:any)=>c.remote_id);this.loaded=true;
 });}
 async page(next:boolean){this.offset=next?(this.nextOffset||0):Math.max(0,this.offset-100);await this.load(false);}
 async importOrder(o:any){await this.action(async()=>{const order=await posRequest(this.api,this.base(`/orders/${o.id}/import`),'POST',{});this.importedIds[o.id]=order.id;this.imported.emit(order);this.notice='Pedido importado #'+order.id+'. Revisá y cobrá desde Pedidos o elegí Cuentas por cobrar.';});}
 selectCustomer(){const c=this.customers.find(x=>x.remote_id===this.booking.customerId);if(c){this.booking.customerName=c.name;this.booking.phone=c.phone;}}
 selectService(){const s=this.services.find(x=>x.slug===this.booking.serviceSlug);if(s?.durationMinutes)this.booking.durationMinutes=s.durationMinutes;}
 async createAppointment(){await this.action(async()=>{
  const body={...this.booking};if(!body.customerId)delete body.customerId;if(!body.serviceSlug)delete body.serviceSlug;
  await posRequest(this.api,this.base('/appointments'),'POST',body);this.booking=this.blankBooking();this.notice='Cita guardada en el calendario único de Zénit.';this.changed.emit();
  const r=await posRequest(this.api,this.base('/appointments?date='+this.day));this.appointments=r.appointments;
 });}
 edit(a:any){this.editId=a.id;this.editingStatus=a.status;this.editingCustomerId=a.customerId||'';this.change={responseMessage:a.responseMessage||'',proposedDate:'',proposedTime:'',requestKey:crypto.randomUUID(),status:'',date:'',time:'',durationMinutes:Math.round((+new Date(a.endAt)-+new Date(a.startAt))/60000)};}
 async updateAppointment(){await this.action(async()=>{const body:any={requestKey:this.change.requestKey};if(this.change.status)body.status=this.change.status;if(this.change.responseMessage)body.responseMessage=this.change.responseMessage;if(this.change.status==='CANCELLED'){if(this.editingCustomerId&&!this.change.responseMessage?.trim())throw Error('Escribí el motivo para la clienta.');if(!!this.change.proposedDate!==!!this.change.proposedTime)throw Error('Completá fecha y hora de la propuesta.');if(this.change.proposedDate){body.proposedDate=this.change.proposedDate;body.proposedTime=this.change.proposedTime;}}if(this.change.status!=='CANCELLED'&&this.change.date&&this.change.time){body.date=this.change.date;body.time=this.change.time;body.durationMinutes=this.change.durationMinutes;}await posRequest(this.api,this.base('/appointments/'+this.editId),'POST',body);this.editId='';this.notice='Agenda actualizada. Los avisos conservan el flujo de notificaciones de Zénit.';const r=await posRequest(this.api,this.base('/appointments?date='+this.day));this.appointments=r.appointments;this.changed.emit();});}
 async retry(op:any){await this.action(async()=>{await posRequest(this.api,this.base('/retry/'+op.id),'POST',{});this.notice='Operación recuperada sin duplicar registros.';this.changed.emit();});}
 money(n:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(+n);}
 status(s:string){return ({PENDING:'Pendiente',CONFIRMED:'Confirmada',COMPLETED:'Completado',CANCELLED:'Cancelado',REFUNDED:'Devuelto',BLOCKED:'Bloqueado',EXPIRED:'Vencida'} as any)[s]||s;}
}
