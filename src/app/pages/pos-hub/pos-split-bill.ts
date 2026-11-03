import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BillCustomer, PosCustomerPicker } from './pos-customer-picker';
import { posRequest } from './pos-api-client';

interface Account {label:string;customer:BillCustomer;quantities:number[];}

@Component({selector:'app-pos-split-bill',standalone:true,imports:[CommonModule,FormsModule,PosCustomerPicker],
  templateUrl:'./pos-split-bill.html',styleUrl:'./pos-split-bill.scss'})
export class PosSplitBill implements OnChanges, OnDestroy {
  @Input() api='';@Input() businessId=0;@Input() order:any;@Input() customers:any[]=[];@Input() loyalty=false;
  @Output() closed=new EventEmitter<void>();@Output() completed=new EventEmitter<any>();
  accounts:Account[]=[];busy=false;error='';preview:any=null;
  private key=crypto.randomUUID();private previewBody='';private destroyed=false;
  constructor(private cd:ChangeDetectorRef){}
  ngOnChanges(changes:any){if(changes.order&&this.order){this.key=crypto.randomUUID();this.accounts=[];this.addAccount();this.addAccount();this.order.items.forEach((i:any,index:number)=>this.accounts[0].quantities[index]=+i.quantity);this.invalidate();}}
  ngOnDestroy(){this.destroyed=true;}
  invalidate(){this.preview=null;this.previewBody='';this.error='';}
  addAccount(){if(this.accounts.length>=20)return;this.accounts.push({label:`Cuenta ${this.accounts.length+1}`,customer:{customer_id:null,loyalty_code:null},quantities:(this.order?.items||[]).map(()=>0)});this.invalidate();}
  removeAccount(){if(this.accounts.length<=2)return;const last=this.accounts.pop()!;last.quantities.forEach((q,i)=>this.accounts[0].quantities[i]=Math.round((+this.accounts[0].quantities[i]+(+q||0))*1000)/1000);this.invalidate();}
  distribute(index:number){const total=Math.round(+this.order.items[index].quantity*1000),base=Math.floor(total/this.accounts.length),rest=total%this.accounts.length;this.accounts.forEach((a,j)=>a.quantities[index]=(base+(j<rest?1:0))/1000);this.invalidate();}
  distributeAll(){this.order.items.forEach((_:any,i:number)=>this.distribute(i));}
  remaining(index:number){return (Math.round(+this.order.items[index].quantity*1000)-this.accounts.reduce((s,a)=>s+Math.round((+a.quantities[index]||0)*1000),0))/1000;}
  get valid(){return this.accounts.length>=2&&this.accounts.every(a=>a.label.trim()&&a.label.length<=160&&a.quantities.some(q=>+q>0)&&a.quantities.every(q=>Number.isFinite(+q)&&+q>=0&&Math.abs(+q*1000-Math.round(+q*1000))<.000001))&&this.order.items.every((_:any,i:number)=>this.remaining(i)===0);}
  money(value:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(+value||0);}
  body(){return {request_key:this.key,expected_revision:this.order.revision,accounts:this.accounts.map(a=>({label:a.label.trim(),customer_id:a.customer.customer_id,loyalty_code:a.customer.loyalty_code,items:a.quantities.map((q,item_index)=>({item_index,quantity:+q})).filter(i=>i.quantity>0)}))};}
  async review(){
    if(!this.valid||this.busy)return;this.busy=true;this.error='';const body=this.body();
    try{this.preview=await posRequest(this.api,`/business/${this.businessId}/orders/${this.order.id}/split/preview`,'POST',body);this.previewBody=JSON.stringify(body);}
    catch(error:any){this.error=error.message;}
    finally{this.busy=false;if(!this.destroyed)this.cd.detectChanges();}
  }
  async confirm(){
    if(!this.preview||this.busy||this.previewBody!==JSON.stringify(this.body()))return;
    this.busy=true;this.error='';
    try{const result=await posRequest(this.api,`/business/${this.businessId}/orders/${this.order.id}/split`,'POST',this.body());this.completed.emit(result);}
    catch(error:any){this.error=error.message;}
    finally{this.busy=false;if(!this.destroyed)this.cd.detectChanges();}
  }
}
