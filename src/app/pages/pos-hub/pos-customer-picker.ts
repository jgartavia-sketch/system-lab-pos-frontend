import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { posRequest } from './pos-api-client';

export interface BillCustomer {
  customer_id: number | null;
  loyalty_code: string | null;
  loyalty_name?: string;
}

@Component({selector:'app-pos-customer-picker',standalone:true,imports:[CommonModule,FormsModule],
  templateUrl:'./pos-customer-picker.html',styleUrl:'./pos-customer-picker.scss'})
export class PosCustomerPicker implements OnChanges, OnDestroy {
  @Input() api='';
  @Input() businessId=0;
  @Input() customers:any[]=[];
  @Input() loyalty=false;
  @Input() disabled=false;
  @Input() selected:BillCustomer={customer_id:null,loyalty_code:null};
  @Output() selectedChange=new EventEmitter<BillCustomer>();
  query='';results:any[]=[];loading=false;error='';searched=false;
  private request=0;
  private destroyed=false;
  private abort?:AbortController;
  constructor(private cd:ChangeDetectorRef){}
  ngOnChanges(changes:any){if(changes.businessId){this.abort?.abort();this.request++;this.results=[];this.query='';this.error='';this.loading=false;this.searched=false;}}
  ngOnDestroy(){this.destroyed=true;this.abort?.abort();}
  localCustomer(id:number|null){
    const customer=this.customers.find(c=>c.id===id);
    this.selectedChange.emit({customer_id:id||null,loyalty_code:this.loyalty&&customer?.remote_id?customer.remote_id:null,
      loyalty_name:customer?.name});
  }
  select(customer:any){
    const local=this.customers.find(c=>c.remote_id===customer.code);
    this.selectedChange.emit({customer_id:local?.id||null,loyalty_code:customer.code,loyalty_name:customer.name});
    this.results=[];this.searched=false;this.query='';
  }
  clear(){this.selectedChange.emit({customer_id:null,loyalty_code:null});}
  async search(){
    if(this.disabled||this.loading||this.query.trim().length<2)return;
    this.abort?.abort();this.abort=new AbortController();const request=++this.request;
    this.loading=true;this.error='';this.results=[];this.searched=false;
    try{
      const data=await posRequest(this.api,`/business/${this.businessId}/loyalty/customers?q=${encodeURIComponent(this.query.trim())}`,'GET',undefined,this.abort.signal);
      if(request===this.request&&!this.destroyed){this.results=data.customers;this.searched=true;}
    }catch(error:any){if(request===this.request&&!this.destroyed)this.error=error.message;}
    finally{if(request===this.request&&!this.destroyed){this.loading=false;this.cd.detectChanges();}}
  }
}
