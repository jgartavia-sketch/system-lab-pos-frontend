import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { posRequest, localPosInput } from './pos-api-client';
import { posDay, posDate } from './pos-order-groups';

@Component({selector:'app-pos-finances',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./pos-finances.html',styleUrl:'./pos-panels.scss'})
export class PosFinances implements OnChanges, OnDestroy {
  @Input({required:true}) api=''; @Input({required:true}) businessId=0; @Input() hasRegister=false;
  @Output() changed=new EventEmitter<void>();
  start=posDay(new Date()).slice(0,8)+'01'; end=posDay(new Date());
  entries:any[]=[]; error=''; notice=''; loading=false; busy=false; voiding:any=null; voidReason='';
  draft=this.blank(); private revision=0; private destroyed=false;
  kinds=[{id:'expense',name:'Gasto operativo'},{id:'purchase',name:'Compra de inventario / insumos'},{id:'other_income',name:'Otro ingreso operativo'},{id:'capital_in',name:'Aporte de capital / financiamiento'},{id:'withdrawal',name:'Retiro del dueño'}];
  methods=[{id:'cash',name:'Efectivo'},{id:'card',name:'Tarjeta'},{id:'sinpe',name:'SINPE'},{id:'transfer',name:'Transferencia'}];
  constructor(private cd:ChangeDetectorRef){}
  blank(){return {request_key:crypto.randomUUID(),kind:'expense',amount:null as number|null,category:'',method:'cash',reason:'',supplier:'',reference:'',occurred_at:localPosInput(),from_register:false};}
  ngOnChanges(changes:any){if(changes.businessId||changes.api){this.entries=[];this.draft=this.blank();this.draft.from_register=this.hasRegister;this.voiding=null;this.error='';this.notice='';this.busy=false;void this.load();}else if(!this.hasRegister){this.draft.from_register=false;}}
  ngOnDestroy(){this.destroyed=true;this.revision++;}
  path(tail=''){return `/business/${this.businessId}/finances${tail}`;}
  money(value:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(Number(value||0));}
  date(value:string){return posDate(value).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'});}
  kindName(value:string){return this.kinds.find(kind=>kind.id===value)?.name||value;}
  methodName(value:string){return this.methods.find(method=>method.id===value)?.name||value;}
  async load(){
    if (!this.businessId) return;
    if (!this.start || !this.end || this.end<this.start){this.error='Revisá el rango de fechas.';return;}
    const revision=++this.revision;this.loading=true;this.error='';
    try{const data=await posRequest(this.api,this.path()+`?start=${this.start}&end=${this.end}`);if(revision===this.revision)this.entries=data.entries;}
    catch(error:any){if(revision===this.revision)this.error=error.message;}
    finally{if(!this.destroyed&&revision===this.revision){this.loading=false;this.cd.detectChanges();}}
  }
  async save(){
    if(this.busy)return;this.busy=true;this.error='';this.notice='';const bid=this.businessId;
    try{await posRequest(this.api,this.path(),'POST',{...this.draft,amount:Number(this.draft.amount),occurred_at:new Date(this.draft.occurred_at+'-06:00').toISOString(),from_register:this.draft.method==='cash'&&this.draft.from_register});
      if(bid!==this.businessId||this.destroyed)return;
      this.notice='Movimiento registrado.';this.draft=this.blank();this.draft.from_register=this.hasRegister;this.changed.emit();await this.load();}
    catch(error:any){if(bid===this.businessId)this.error=error.message;}
    finally{if(bid===this.businessId&&!this.destroyed){this.busy=false;this.cd.detectChanges();}}
  }
  async voidEntry(){
    if(this.busy||!this.voiding)return;this.busy=true;this.error='';const bid=this.businessId;
    try{await posRequest(this.api,this.path('/'+this.voiding.id+'/void'),'POST',{reason:this.voidReason});if(bid!==this.businessId||this.destroyed)return;this.voiding=null;this.voidReason='';this.notice='Movimiento anulado; se conserva el historial.';this.changed.emit();await this.load();}
    catch(error:any){if(bid===this.businessId)this.error=error.message;}
    finally{if(bid===this.businessId&&!this.destroyed){this.busy=false;this.cd.detectChanges();}}
  }
}
