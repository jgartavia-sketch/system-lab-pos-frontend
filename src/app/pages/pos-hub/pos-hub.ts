import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({selector:'app-pos-hub', standalone:true, imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./pos-hub.html',styleUrl:'./pos-hub.scss'})
export class PosHub implements OnInit, OnDestroy {
  modes=[{id:'restaurante',name:'Restaurante',icon:'01',copy:'Mesas, comandas, cocina y venta rápida.'},{id:'heladeria',name:'Heladería',icon:'02',copy:'Mostrador, productos, pedidos y existencias.'},{id:'supermercado',name:'Supermercado',icon:'03',copy:'Venta por código, inventario y control de caja.'},{id:'taller',name:'Taller mecánico',icon:'04',copy:'Órdenes de trabajo, repuestos, servicios y citas.'},{id:'salon',name:'Salón de belleza',icon:'05',copy:'Servicios, productos, clientes y agenda.'}];
  tabs=[['dashboard','Resumen'],['sale','Nueva venta'],['orders','Pedidos'],['kitchen','Cocina'],['products','Productos'],['inventory','Inventario'],['customers','Clientes'],['cash','Caja'],['reports','Reportes'],['appointments','Agenda'],['account','Mi cuenta']];
  api='https://system-lab-pos-backend.onrender.com/pos-api';
  mode=''; token=sessionStorage.getItem('systemlab-pos-token')||''; account:any=null; businesses:any[]=[]; bid=0; data:any=null; tab='dashboard';
  error=''; notice=''; busy=false; booting=true; loginEmail=''; loginPassword=''; search=''; category='';
  cartKey=crypto.randomUUID(); cart:any[]=[]; label='Mostrador'; tableNumber:any=null; customerId:any=null; notes=''; discount=0; editingOrder=0;
  product:any=this.blankProduct(); productId=0; customer:any={name:'',phone:'',email:''}; customerEdit=0;
  stockForm:any={product_id:0,kind:'entry',quantity:0,reason:''}; cashAmount=0; cashForm:any={kind:'expense',amount:0,reason:''};
  paymentOrder:any=null; method='cash'; received=0; receipt:any=null;
  start=this.today(); end=this.today(); report:any=null;
  appointment:any={customer_id:0,title:'',at:'',status:'pending',notes:''}; appointmentId=0;
  adminData:any=null; newBusiness:any={name:'',mode:'restaurante',tables:10,active:true}; businessEdit=0;
  newAccount:any={name:'',email:'',password:'',business_ids:[]}; access:any=null; resetPassword='';
  currentPassword=''; nextPassword=''; private poll:any; private params:any;
  constructor(private route:ActivatedRoute,private router:Router,private cd:ChangeDetectorRef){}
  today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  blankProduct(){return {name:'',category:'General',sku:'',price:0,cost:0,tax_rate:0,minimum:0,track_stock:true,active:true};}
  ngOnInit(){this.params=this.route.paramMap.subscribe(p=>{this.mode=p.get('mode')||'';this.tab='dashboard';this.bid=0;this.data=null;void this.initialize();});this.poll=setInterval(()=>{if(this.bid&&!this.busy&&['kitchen','orders','dashboard'].includes(this.tab))void this.refresh().catch(()=>{});},15000);}
  ngOnDestroy(){clearInterval(this.poll);this.params?.unsubscribe();}
  async request(path:string,method='GET',body?:any){
    const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),45000);
    try{
      const r=await fetch(this.api+path,{method,headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:ctl.signal});
      const raw=await r.text();let result:any;try{result=JSON.parse(raw);}catch{throw Error(r.status>=500?'El servidor no pudo completar la operación. Reintentá en unos segundos.':'Respuesta inesperada del servidor.');}
      if(!r.ok){if(r.status===401){this.token='';this.account=null;this.data=null;this.bid=0;sessionStorage.removeItem('systemlab-pos-token');}throw Error(typeof result.detail==='string'?result.detail:'Revisá los campos: hay un valor inválido.');}
      return result;
    }catch(e:any){if(e.name==='AbortError')throw Error('El servidor tardó en responder. Esperá unos segundos y reintentá.');throw e;}
    finally{clearTimeout(timeout);}
  }
  async run(action:()=>Promise<void>){if(this.busy)return;this.busy=true;this.error='';this.notice='';try{await action();}catch(e:any){this.error=e.message||'No se pudo completar la operación.';}finally{this.busy=false;this.cd.detectChanges();}}
  async initialize(){this.booting=true;await this.run(async()=>{if(this.token){const r=await this.request('/auth/me');this.account=r.account;this.businesses=r.businesses;}});this.booting=false;this.cd.detectChanges();}
  async login(){await this.run(async()=>{const r=await this.request('/auth/login','POST',{email:this.loginEmail,password:this.loginPassword});this.token=r.token;sessionStorage.setItem('systemlab-pos-token',this.token);this.loginPassword='';const me=await this.request('/auth/me');this.account=me.account;this.businesses=me.businesses;});}
  async logout(){await this.run(async()=>{try{await this.request('/auth/logout','POST');}finally{this.token='';this.account=null;this.bid=0;this.data=null;sessionStorage.removeItem('systemlab-pos-token');}});}
  get modeName(){return this.modes.find(m=>m.id===this.mode)?.name||'POS';}
  get validMode(){return this.modes.some(m=>m.id===this.mode);}
  get available(){return this.businesses.filter(b=>b.mode===this.mode);}
  get products(){return (this.data?.products||[]).filter((p:any)=>p.active&&(!this.category||p.category===this.category)&&(!this.search||(p.name+' '+p.sku).toLowerCase().includes(this.search.toLowerCase())));}
  get categories():string[]{return [...new Set<string>((this.data?.products||[]).map((p:any)=>p.category))];}
  get pending(){return (this.data?.orders||[]).filter((o:any)=>['open','queued','preparing','ready'].includes(o.status));}
  get lowStock(){return (this.data?.products||[]).filter((p:any)=>p.active&&p.track_stock&&+p.stock<=+p.minimum);}
  get tables(){return Array.from({length:this.data?.business?.tables||0},(_,i)=>i+1);}
  get visibleTabs(){return this.tabs.filter(t=>t[0]!=='kitchen'||['restaurante','heladeria'].includes(this.mode));}
  get subtotal(){return this.cart.reduce((v,i)=>v+Math.round(+i.price*+i.quantity*100)/100,0);}
  get estimatedTotal(){const sub=this.subtotal;return Math.max(0,sub-this.discount)+this.cart.reduce((v,i)=>v+Math.round((+i.price*+i.quantity)*(sub?Math.max(0,sub-this.discount)/sub:1)*+i.tax_rate)/100,0);}
  get totalLabel(){return this.mode==='taller'?'Orden de trabajo':this.mode==='salon'?'Servicio / venta':'Pedido';}
  money(v:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(Number(v||0));}
  date(v:string){return v?new Date(v).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'}):'—';}
  status(v:string){return ({open:'Abierto',queued:'En cola',preparing:'En preparación',ready:'Listo',paid:'Pagado',cancelled:'Cancelado',refunded:'Devuelto',pending:'Pendiente',confirmed:'Confirmada',completed:'Completada'} as any)[v]||v;}
  paymentName(v:string){return ({cash:'Efectivo',card:'Tarjeta',sinpe:'SINPE',transfer:'Transferencia'} as any)[v]||v;}
  async enter(b:any){await this.run(async()=>{this.bid=b.id;this.tab='dashboard';this.cart=[];await this.refresh();});}
  async refresh(){if(!this.bid)return;this.data=await this.request('/business/'+this.bid+'/state');this.cd.detectChanges();}
  path(p:string){return '/business/'+this.bid+p;}
  async mutate(p:string,body:any,method='POST'){const r=await this.request(this.path(p),method,body);await this.refresh();return r;}
  async navigate(tab:string){this.tab=tab;if(tab==='reports')await this.loadReport();if(tab==='admin')await this.loadAdmin();}
  add(p:any){const existing=this.cart.find(i=>i.product_id===p.id);if(existing)existing.quantity=+existing.quantity+1;else this.cart.push({product_id:p.id,name:p.name,price:p.price,tax_rate:p.tax_rate,quantity:1});}
  scan(){const p=this.products.find((p:any)=>p.sku===this.search);if(p){this.add(p);this.search='';}}
  resetCart(){this.cartKey=crypto.randomUUID();this.cart=[];this.label='Mostrador';this.tableNumber=null;this.customerId=null;this.notes='';this.discount=0;this.editingOrder=0;}
  useTable(n:number){const order=this.pending.find((o:any)=>o.table_number===n);if(order){this.edit(order);return;}this.resetCart();this.tableNumber=n;this.label='Mesa '+n;this.tab='sale';}
  occupied(n:number){return this.pending.some((o:any)=>o.table_number===n);}
  edit(o:any){if(!['open','queued'].includes(o.status)){this.tab='orders';return;}this.editingOrder=o.id;this.cart=o.items.map((i:any)=>({...i,quantity:+i.quantity}));this.label=o.label;this.tableNumber=o.table_number;this.customerId=o.customer_id;this.notes=o.notes;this.discount=+o.discount;this.tab='sale';}
  async saveOrder(checkout=false){await this.run(async()=>{if(!this.cart.length)throw Error('Agregá al menos un producto.');const body={request_key:this.cartKey,label:this.label,table_number:this.tableNumber?+this.tableNumber:null,customer_id:this.customerId?+this.customerId:null,notes:this.notes,discount:+this.discount,items:this.cart.map(i=>({product_id:i.product_id,quantity:+i.quantity}))};const o=await this.mutate('/orders'+(this.editingOrder?'/'+this.editingOrder:''),body,this.editingOrder?'PUT':'POST');this.resetCart();this.tab='orders';this.notice='Pedido guardado #'+o.id;if(checkout)this.openPayment(o);});}
  async transition(o:any,status:string){if(status==='cancelled'&&!confirm('¿Cancelar este pedido?'))return;await this.run(async()=>{await this.mutate('/orders/'+o.id+'/status',{status});});}
  openPayment(o:any){this.paymentOrder=o;this.method='cash';this.received=+o.total;}
  async pay(){await this.run(async()=>{const o=await this.mutate('/orders/'+this.paymentOrder.id+'/pay',{method:this.method,received:+this.received});this.paymentOrder=null;this.receipt=o;this.notice='Venta registrada. Inventario actualizado.';});}
  async refund(o:any){const reason=prompt('Motivo de devolución total (reintegra todas las existencias):');if(!reason)return;await this.run(async()=>{await this.mutate('/orders/'+o.id+'/refund',{reason});this.notice='Devolución registrada. Realizá el reintegro al cliente por '+this.paymentName(o.payment_method)+'.';});}
  print(){window.print();}
  editProduct(p:any){this.productId=p.id;this.product={...this.blankProduct()};for(const k of Object.keys(this.product))this.product[k]=p[k];this.tab='products';}
  async saveProduct(){await this.run(async()=>{await this.mutate('/products'+(this.productId?'/'+this.productId:''),this.product,this.productId?'PUT':'POST');this.product=this.blankProduct();this.productId=0;this.notice='Producto guardado. Cargá sus existencias en Inventario.';});}
  async saveStock(){await this.run(async()=>{const {product_id,...p}=this.stockForm;await this.mutate('/products/'+product_id+'/stock',p);this.stockForm={product_id:0,kind:'entry',quantity:0,reason:''};this.notice='Inventario actualizado.';});}
  editCustomer(c:any){this.customerEdit=c.id;this.customer={name:c.name,phone:c.phone,email:c.email};}
  async saveCustomer(){await this.run(async()=>{await this.mutate('/customers'+(this.customerEdit?'/'+this.customerEdit:''),this.customer,this.customerEdit?'PUT':'POST');this.customerEdit=0;this.customer={name:'',phone:'',email:''};this.notice='Cliente guardado.';});}
  async cashAction(close=false){if(close&&!confirm('¿Cerrar la caja con el efectivo contado indicado?'))return;await this.run(async()=>{const r=await this.mutate('/register/'+(close?'close':'open'),{amount:+this.cashAmount});this.cashAmount=0;this.notice=close?'Caja cerrada. Diferencia: '+this.money(r.difference):'Caja abierta.';});}
  async saveCash(){await this.run(async()=>{await this.mutate('/cash',this.cashForm);this.cashForm={kind:'expense',amount:0,reason:''};this.notice='Movimiento registrado.';});}
  async loadReport(){await this.run(async()=>{this.report=await this.request(this.path('/reports')+'?start='+this.start+'&end='+this.end);});}
  exportCSV(){if(!this.report)return;const rows=[['Venta','Fecha','Método','Subtotal','Descuento','Impuesto','Total'],...this.report.orders.map((o:any)=>[o.id,this.date(o.paid_at),this.paymentName(o.payment_method),o.subtotal,o.discount,o.tax,o.total])];const csv='\ufeff'+rows.map(r=>r.map((v:any)=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='ventas-'+this.start+'.csv';a.click();URL.revokeObjectURL(u);}
  async saveAppointment(){await this.run(async()=>{await this.mutate('/appointments'+(this.appointmentId?'/'+this.appointmentId:''),{...this.appointment,customer_id:+this.appointment.customer_id,at:new Date(this.appointment.at).toISOString()},this.appointmentId?'PUT':'POST');this.appointmentId=0;this.appointment={customer_id:0,title:'',at:'',status:'pending',notes:''};this.notice='Cita guardada.';});}
  editAppointment(p:any){this.appointmentId=p.id;const d=new Date(p.at);this.appointment={customer_id:p.customer_id,title:p.title,at:new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16),status:p.status,notes:p.notes};}
  async changePassword(){await this.run(async()=>{const r=await this.request('/auth/password','POST',{current:this.currentPassword,password:this.nextPassword});this.token=r.token;sessionStorage.setItem('systemlab-pos-token',this.token);this.currentPassword='';this.nextPassword='';this.notice='Contraseña actualizada. Las sesiones anteriores quedaron cerradas.';});}
  async loadAdmin(){await this.run(async()=>{this.adminData=await this.request('/admin');});}
  async saveBusiness(){await this.run(async()=>{await this.request('/admin/businesses'+(this.businessEdit?'/'+this.businessEdit:''),this.businessEdit?'PUT':'POST',this.newBusiness);this.businessEdit=0;this.newBusiness={name:'',mode:'restaurante',tables:10,active:true};this.adminData=await this.request('/admin');this.notice='Negocio guardado. Asigná el acceso a una cuenta.';});}
  editBusiness(b:any){this.businessEdit=b.id;this.newBusiness={name:b.name,mode:b.mode,tables:b.tables,active:b.active};}
  toggleBusiness(obj:any,id:number){obj.business_ids=obj.business_ids.includes(id)?obj.business_ids.filter((v:number)=>v!==id):[...obj.business_ids,id];}
  async saveAccount(){await this.run(async()=>{await this.request('/admin/accounts','POST',this.newAccount);this.newAccount={name:'',email:'',password:'',business_ids:[]};this.adminData=await this.request('/admin');this.notice='Cuenta creada.';});}
  editAccess(u:any){this.resetPassword='';this.access={...u,business_ids:[...u.business_ids]};}
  async resetAccountPassword(){await this.run(async()=>{await this.request('/admin/accounts/'+this.access.id+'/password','POST',{password:this.resetPassword});this.resetPassword='';this.notice='Contraseña restablecida. Las sesiones anteriores quedaron cerradas.';if(this.access.id===this.account.id){this.token='';sessionStorage.removeItem('systemlab-pos-token');this.account=null;this.data=null;this.bid=0;}});}
  async saveAccess(){await this.run(async()=>{await this.request('/admin/accounts/'+this.access.id,'PUT',{active:this.access.active,business_ids:this.access.business_ids});const self=this.access.id===this.account.id;this.access=null;if(self){this.token='';sessionStorage.removeItem('systemlab-pos-token');this.account=null;this.data=null;this.bid=0;this.notice='Permisos guardados. Volvé a ingresar.';}else{this.adminData=await this.request('/admin');this.notice='Acceso actualizado.';}});}
  customerName(id:number){return this.data?.customers.find((c:any)=>c.id===id)?.name||'Consumidor final';}
  productName(id:number){return this.data?.products.find((p:any)=>p.id===id)?.name||'—';}
}
