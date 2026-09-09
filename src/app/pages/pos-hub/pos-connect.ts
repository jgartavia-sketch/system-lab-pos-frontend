import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { posRequest } from './pos-api-client';
import { posDay, posDate } from './pos-order-groups';

@Component({selector:'app-pos-connect',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./pos-connect.html',styleUrl:'./pos-panels.scss'})
export class PosConnect implements OnChanges, OnDestroy {
  @Input({required:true}) api=''; @Input({required:true}) businessId=0; @Input() hasRegister=false;
  @Output() imported=new EventEmitter<any>();
  start=posDay(new Date()).slice(0,8)+'01';end=posDay(new Date());
  summary:any=null;customers:any[]=[];total=0;query='';appliedQuery='';offset=0;limit=25;
  summaryLoading=false;customersLoading=false;busy=false;error='';notice='';editing:any=null;
  adjustment={request_key:crypto.randomUUID(),direction:1,amount:1,reason:''};
  private generation=0;private customerRequest=0;private summaryRequest=0;private destroyed=false;
  constructor(private cd:ChangeDetectorRef){}
  ngOnChanges(changes:any){if(changes.businessId||changes.api){this.generation++;this.customerRequest++;this.summaryRequest++;this.summary=null;this.customers=[];this.editing=null;this.query='';this.appliedQuery='';this.offset=0;this.busy=false;this.error='';this.notice='';void this.loadCustomers(true);void this.loadSummary();}}
  ngOnDestroy(){this.destroyed=true;this.generation++;}
  path(tail:string){return `/business/${this.businessId}/connect${tail}`;}
  money(value:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(Number(value||0));}
  date(value:string){return posDate(value).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'});}
  get channelRows(){return [{key:'website',label:'Desde el sitio web',count:Number(this.summary?.orders?.website||0)},{key:'whatsapp',label:'WhatsApp directo',count:Number(this.summary?.direct_whatsapp?.orders||0)},{key:'legacy',label:'Historial sin clasificar',count:Number(this.summary?.orders?.legacy||0)}];}
  width(count:number){return 100*count/Math.max(1,...this.channelRows.map(row=>row.count));}
  get projectedPoints(){return Number(this.editing?.points||0)+Number(this.adjustment.direction)*Number(this.adjustment.amount||0);}
  get lastCustomer(){return Math.min(this.total,this.offset+this.customers.length);}
  async loadSummary(){
    if(!this.businessId)return;if(!this.start||!this.end||this.end<this.start){this.error='Revisá el rango de fechas.';return;}
    const id=++this.summaryRequest,generation=this.generation;this.summaryLoading=true;this.error='';
    try{const result=await posRequest(this.api,this.path(`/summary?start=${this.start}&end=${this.end}`));if(generation===this.generation&&id===this.summaryRequest)this.summary=result;}
    catch(error:any){if(generation===this.generation&&id===this.summaryRequest)this.error=error.message;}
    finally{if(!this.destroyed&&generation===this.generation&&id===this.summaryRequest){this.summaryLoading=false;this.cd.detectChanges();}}
  }
  async loadCustomers(reset=false){
    if(!this.businessId)return;if(reset){this.offset=0;this.appliedQuery=this.query.trim();}
    const id=++this.customerRequest,generation=this.generation;this.customersLoading=true;this.error='';
    try{const result=await posRequest(this.api,this.path(`/customers?q=${encodeURIComponent(this.appliedQuery)}&offset=${this.offset}&limit=${this.limit}`));if(generation===this.generation&&id===this.customerRequest){this.customers=result.customers;this.total=result.total;}}
    catch(error:any){if(generation===this.generation&&id===this.customerRequest)this.error=error.message;}
    finally{if(!this.destroyed&&generation===this.generation&&id===this.customerRequest){this.customersLoading=false;this.cd.detectChanges();}}
  }
  page(direction:number){this.offset=Math.max(0,this.offset+direction*this.limit);void this.loadCustomers();}
  editPoints(customer:any){this.editing={...customer};this.adjustment={request_key:crypto.randomUUID(),direction:1,amount:1,reason:''};this.notice='';this.cd.detectChanges();const form=document.getElementById('pos-connect-points');form?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});form?.querySelector<HTMLInputElement>('input[name="pointsAmount"]')?.focus({preventScroll:true});}
  async savePoints(){
    if(this.busy||!this.editing||!Number.isInteger(Number(this.adjustment.amount))||this.adjustment.amount<1||this.projectedPoints<0)return;
    this.busy=true;this.error='';const generation=this.generation;const code=this.editing.code;
    try{const result=await posRequest(this.api,this.path('/customers/'+encodeURIComponent(code)+'/points'),'POST',{request_key:this.adjustment.request_key,delta:Number(this.adjustment.direction)*Number(this.adjustment.amount),reason:this.adjustment.reason});
      if(generation!==this.generation||this.destroyed)return;
      this.notice=`Puntos actualizados: ${result.points}.`;this.editing=null;await this.loadCustomers();await this.loadSummary();}
    catch(error:any){if(generation===this.generation)this.error=error.message;}
    finally{if(generation===this.generation&&!this.destroyed){this.busy=false;this.cd.detectChanges();}}
  }
  async importOrder(order:any){
    if(this.busy||!this.hasRegister)return;this.busy=true;this.error='';const generation=this.generation;
    try{const result=await posRequest(this.api,this.path('/orders/'+encodeURIComponent(order.id)+'/import'),'POST',{});if(generation!==this.generation||this.destroyed)return;if(this.summary)this.summary.imported_ids=[...(this.summary.imported_ids||[]),order.id];this.imported.emit(result);}
    catch(error:any){if(generation===this.generation)this.error=error.message;}
    finally{if(generation===this.generation&&!this.destroyed){this.busy=false;this.cd.detectChanges();}}
  }
  alreadyImported(id:string){return this.summary?.imported_ids?.includes(id);}
}
