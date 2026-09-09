import { Component, ChangeDetectorRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { groupOrderDays, OrderDay, posDate, posDay, stepQuantity } from './pos-order-groups';
import { PosDashboard } from './pos-dashboard';
import { PosFinances } from './pos-finances';
import { PosConnect } from './pos-connect';
import { appointmentOverview, AppointmentDay } from './pos-appointments';

@Component({selector:'app-pos-hub', standalone:true, imports:[CommonModule,FormsModule,RouterLink,PosDashboard,PosFinances,PosConnect],templateUrl:'./pos-hub.html',styleUrl:'./pos-hub.scss'})
export class PosHub implements OnInit, OnDestroy {
  modes=[{id:'restaurante',name:'Restaurante',icon:'01',copy:'Mesas, comandas, cocina y venta rápida.'},{id:'heladeria',name:'Heladería',icon:'02',copy:'Mostrador, productos, pedidos y existencias.'},{id:'supermercado',name:'Supermercado',icon:'03',copy:'Venta por código, inventario y control de caja.'},{id:'taller',name:'Taller mecánico',icon:'04',copy:'Órdenes de trabajo, repuestos, servicios y citas.'},{id:'salon',name:'Salón de belleza',icon:'05',copy:'Servicios, productos, clientes y agenda.'}];
  tabs=[['dashboard','Resumen'],['sale','Nueva venta'],['orders','Pedidos'],['kitchen','Cocina'],['products','Productos'],['inventory','Inventario'],['customers','Clientes'],['cash','Caja'],['finances','Ingresos y gastos'],['reports','Reportes'],['appointments','Agenda'],['team','Mi equipo'],['audit','Autorizaciones'],['account','Mi cuenta']];
  api='https://system-lab-pos-backend.onrender.com/pos-api';
  mode=''; token=sessionStorage.getItem('systemlab-pos-token')||''; account:any=null; businesses:any[]=[]; bid=0; data:any=null; tab='dashboard';
  error=''; notice=''; busy=false; booting=true; loginEmail=''; loginPassword=''; search=''; category='';
  cartKey=crypto.randomUUID(); cart:any[]=[]; label='Mostrador'; tableNumber:any=null; customerId:any=null; notes=''; discount=0; editingOrder=0; editingRevision=0;
  product:any=this.blankProduct(); productId=0; customer:any={name:'',phone:'',email:''}; customerEdit=0;
  stockForm:any={product_id:0,kind:'entry',quantity:0,reason:''}; cashAmount=0; cashForm:any={kind:'expense',amount:0,reason:''};
  paymentOrder:any=null; method='cash'; received=0; receipt:any=null;
  start=this.today(); end=this.today(); report:any=null;
  appointment:any={customer_id:0,title:'',at:'',status:'pending',notes:''}; appointmentId=0;
  orderDays:OrderDay[]=[]; kitchenDays:OrderDay[]=[]; openedDays:Record<string,boolean>={}; dashboardRevision='';
  team:any=null; staff:any={name:'',email:'',password:'',role:'waiter',can_pay:true}; staffEdit:any=null; staffPassword=''; linkStaff=0; linkRole='waiter'; linkPay=true;
  auditRows:any[]=[]; pinPassword=''; pinCode=''; approvalEmail=''; approvalPin=''; adjustmentReason=''; comanda:any=null; menuOpen=false; basketVisible=false;
  roles=[{id:'admin',name:'Administrador'},{id:'cashier',name:'Cajero'},{id:'waiter',name:'Salonero'},{id:'kitchen',name:'Cocina'}];
  sourceChannel='pos'; fulfillment='dine_in'; externalOrderId='';
  currentPassword=''; nextPassword=''; private poll:any; private params:any;
  constructor(private route:ActivatedRoute,private router:Router,private cd:ChangeDetectorRef){}
  today(){return posDay(new Date());}
  blankProduct(){return {name:'',category:'General',sku:'',price:0,cost:0,tax_rate:0,minimum:0,track_stock:true,active:true,packaging_fee:0,cost_known:true};}
  ngOnInit(){this.params=this.route.paramMap.subscribe(p=>{this.mode=p.get('mode')||'';this.tab='dashboard';this.bid=0;this.data=null;this.resetCart();void this.initialize();});this.poll=setInterval(()=>{if(this.bid&&!this.busy&&['kitchen','orders','dashboard','appointments'].includes(this.tab))void this.refresh().catch((e:any)=>{this.error=e.message;this.cd.detectChanges();});},5000);}
  ngOnDestroy(){clearInterval(this.poll);this.params?.unsubscribe();}
  async request(path:string,method='GET',body?:any){
    const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),45000);
    try{
      const r=await fetch(this.api+path,{method,headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:ctl.signal});
      const raw=await r.text();let result:any;try{result=JSON.parse(raw);}catch{throw Error(r.status>=500?'El servidor no pudo completar la operación. Reintentá en unos segundos.':'Respuesta inesperada del servidor.');}
      if(!r.ok){if(r.status===403&&path.endsWith('/state')){this.businesses=this.businesses.filter(b=>b.id!==this.bid);this.bid=0;this.data=null;this.paymentOrder=null;this.receipt=null;this.comanda=null;this.resetCart();}if(r.status===401){this.token='';this.account=null;this.data=null;this.bid=0;this.resetCart();this.paymentOrder=null;this.receipt=null;this.comanda=null;sessionStorage.removeItem('systemlab-pos-token');}throw Error(typeof result.detail==='string'?result.detail:'Revisá los campos: hay un valor inválido.');}
      return result;
    }catch(e:any){if(e.name==='AbortError')throw Error('El servidor tardó en responder. Esperá unos segundos y reintentá.');throw e;}
    finally{clearTimeout(timeout);}
  }
  async run(action:()=>Promise<void>){if(this.busy)return;this.busy=true;this.error='';this.notice='';try{await action();}catch(e:any){this.error=e.message||'No se pudo completar la operación.';}finally{this.busy=false;this.cd.detectChanges();}}
  async initialize(){this.booting=true;await this.run(async()=>{if(this.token){const r=await this.request('/auth/me');this.account=r.account;this.businesses=r.businesses;}});this.booting=false;this.cd.detectChanges();}
  async login(){await this.run(async()=>{const r=await this.request('/auth/login','POST',{email:this.loginEmail,password:this.loginPassword});this.token=r.token;sessionStorage.setItem('systemlab-pos-token',this.token);this.loginPassword='';const me=await this.request('/auth/me');this.account=me.account;this.businesses=me.businesses;});}
  async logout(){await this.run(async()=>{try{await this.request('/auth/logout','POST');}finally{this.token='';this.account=null;this.bid=0;this.data=null;this.resetCart();this.paymentOrder=null;this.receipt=null;this.comanda=null;sessionStorage.removeItem('systemlab-pos-token');}});}
  get modeName(){return this.modes.find(m=>m.id===this.mode)?.name||'POS';}
  get validMode(){return this.modes.some(m=>m.id===this.mode);}
  get available(){return this.businesses.filter(b=>b.mode===this.mode);}
  get products(){return (this.data?.products||[]).filter((p:any)=>p.active&&(!this.category||p.category===this.category)&&(!this.search||(p.name+' '+p.sku).toLowerCase().includes(this.search.toLowerCase())));}
  get categories():string[]{return [...new Set<string>((this.data?.products||[]).map((p:any)=>p.category))];}
  get kitchenOrders(){return (this.data?.orders||[]).filter((o:any)=>['queued','preparing','ready'].includes(o.kitchen_status));}
  get pending(){return (this.data?.orders||[]).filter((o:any)=>['open','queued','preparing','ready'].includes(o.status));}
  get lowStock(){return (this.data?.products||[]).filter((p:any)=>p.active&&p.track_stock&&+p.stock<=+p.minimum);}
  get activeProductCount(){return (this.data?.products||[]).filter((p:any)=>p.active).length;}
  get tables(){return Array.from({length:this.data?.business?.tables||0},(_,i)=>i+1);}
  get rights():any{return this.data?.permissions||{};}
  get visibleTabs(){return this.tabs.filter(t=>{
    if(t[0]==='kitchen')return ['restaurante','heladeria'].includes(this.mode);
    if(['products','inventory','reports','audit','finances'].includes(t[0]))return this.rights.manage;
    if(t[0]==='team')return this.rights.team;
    if(t[0]==='cash')return this.rights.cash;
    if(['sale','customers','appointments'].includes(t[0]))return this.rights.sell;
    return true;
  }).map(t=>t[0]==='dashboard'&&this.rights.manage?['dashboard','Panel administrativo']:t[0]==='appointments'&&this.tableReservations?['appointments','Reservaciones']:t);}
  get tableReservations(){return this.mode==='restaurante';}
  get agenda(){return appointmentOverview(this.data?.appointments||[],this.today());}
  appointmentTime(value:string){return posDate(value).toLocaleTimeString('es-CR',{timeZone:'America/Costa_Rica',hour:'2-digit',minute:'2-digit'});}
  appointmentStatus(value:string){return ({pending:'Por confirmar',confirmed:'Confirmada',completed:'Completada',cancelled:'Cancelada'} as Record<string,string>)[value]||this.status(value);}
  trackAppointmentDay(_index:number,group:AppointmentDay){return group.day;}
  roleName(role:string){return role==='owner'?'Dueño':this.roles.find(r=>r.id===role)?.name||role;}
  get needsApproval(){return this.discount>0||this.cart.some(i=>+i.price!==+(this.data?.products.find((p:any)=>p.id===i.product_id)?.price??i.price));}
  canCancel(o:any){return this.rights.manage||(this.rights.sell&&o.status==='open'&&o.account_id===this.account.id);}
  changeBusiness(){if(this.cart.length&&!confirm('¿Descartar el pedido sin guardar y cambiar de local?'))return;this.resetCart();this.bid=0;this.data=null;this.paymentOrder=null;this.receipt=null;this.comanda=null;this.tab='dashboard';this.menuOpen=false;void this.initialize();}
  @HostListener('window:scroll') onScroll(){const r=document.getElementById('pos-basket')?.getBoundingClientRect();this.basketVisible=!!r&&r.top<innerHeight*.65&&r.bottom>100;}
  jumpToCart(){this.basketVisible=true;document.getElementById('pos-basket')?.scrollIntoView({behavior:'smooth',block:'start'});}

  get subtotal(){return this.cart.reduce((v,i)=>v+Math.round(+i.price*+i.quantity*100)/100,0);}
  get estimatedTotal(){const sub=this.subtotal;return this.packagingTotal+this.serviceTotal+Math.max(0,sub-this.discount)+this.cart.reduce((v,i)=>v+Math.round((+i.price*+i.quantity)*(sub?Math.max(0,sub-this.discount)/sub:1)*+i.tax_rate)/100,0);}
  get packagingTotal(){return ['pickup','express'].includes(this.fulfillment)?Math.round(this.cart.reduce((sum,item)=>sum+Number(this.data?.products.find((p:any)=>p.id===item.product_id)?.packaging_fee??item.packaging_fee??0)*Number(item.quantity),0)*100)/100:0;}
  get serviceTotal(){return this.fulfillment==='dine_in'?Math.round(Math.max(0,this.subtotal-this.discount)*Number(this.data?.business?.service_rate||0))/100:0;}
  fulfillmentName(value:string){return ({dine_in:'En el local',pickup:'Para llevar',express:'Express'} as Record<string,string>)[value]||value;}
  sourceName(value:string){return ({pos:'Mostrador / POS',website:'Sitio web',whatsapp:'WhatsApp directo'} as Record<string,string>)[value]||'Mostrador / POS';}
  async refreshFinance(){await this.run(async()=>{await this.refresh();});}
  async importedOrder(order:any){const keepCart=!!this.cart.length;if(keepCart)this.tab='orders';else this.edit(order);await this.refreshFinance();this.notice='Pedido del sitio importado #'+order.id+(keepCart?'. Tu carrito anterior se conserva en Nueva venta.':'. Revisá sus datos antes de cobrar o enviarlo a cocina.');this.cd.detectChanges();}
  get totalLabel(){return this.mode==='taller'?'Orden de trabajo':this.mode==='salon'?'Servicio / venta':'Pedido';}
  money(v:any){return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC'}).format(Number(v||0));}
  date(v:string){return v?posDate(v).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'}):'—';}
  status(v:string){return ({open:'Abierto',queued:'En cola',preparing:'En preparación',ready:'Listo',paid:'Pagado',cancelled:'Cancelado',refunded:'Devuelto',served:'Entregado',pending:'Pendiente',confirmed:'Confirmada',completed:'Completada'} as any)[v]||v;}
  paymentName(v:string){return ({cash:'Efectivo',card:'Tarjeta',sinpe:'SINPE',transfer:'Transferencia'} as any)[v]||v;}
  async enter(b:any){await this.run(async()=>{this.bid=b.id;this.tab='dashboard';this.resetCart();this.report=null;this.team=null;this.openedDays={};await this.refresh();if(this.rights.role==='kitchen')this.tab='kitchen';});}
  async refresh(){if(!this.bid)return;const bid=this.bid;const data=await this.request('/business/'+bid+'/state');if(bid!==this.bid)return;this.data=data;this.orderDays=groupOrderDays(data.orders);this.kitchenDays=groupOrderDays(data.orders,true);this.dashboardRevision=JSON.stringify([data.orders.map((o:any)=>[o.id,o.revision]),data.movements.filter((m:any)=>m.kind!=='stock').map((m:any)=>m.id),data.finance_revision||'']);if(!this.visibleTabs.some(t=>t[0]===this.tab))this.tab='dashboard';this.cd.detectChanges();}
  path(p:string){return '/business/'+this.bid+p;}
  async mutate(p:string,body:any,method='POST'){const r=await this.request(this.path(p),method,body);await this.refresh();return r;}
  async navigate(tab:string){if(!this.visibleTabs.some(t=>t[0]===tab))return;this.tab=tab;this.menuOpen=false;if(tab==='team')await this.loadTeam();if(tab==='audit')await this.loadAudit();if(tab==='reports')await this.loadReport();if(tab==='appointments')await this.run(async()=>{await this.refresh();});}
  dayOpen(section:string,day:string){return this.openedDays[section+':'+day]??day===this.today();}
  toggleDay(section:string,day:string,event:Event){this.openedDays[section+':'+day]=(event.target as HTMLDetailsElement).open;}
  trackDay(_index:number,day:OrderDay){return day.day;}
  trackId(_index:number,item:any){return item.id;}
  trackLane(_index:number,lane:any){return lane.status;}
  changeQuantity(item:any,direction:-1|1,event?:Event){event?.preventDefault();item.quantity=stepQuantity(item.quantity,direction);}
  scrollKitchen(track:HTMLElement,direction:-1|1){const card=track.querySelector<HTMLElement>('.kitchen-card');track.scrollBy({left:direction*((card?.offsetWidth||track.clientWidth)+16),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  kitchenKey(event:KeyboardEvent,track:HTMLElement){if(event.target!==event.currentTarget)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();this.scrollKitchen(track,event.key==='ArrowLeft'?-1:1);}}
  add(p:any){this.onScroll();const existing=this.cart.find(i=>i.product_id===p.id);if(existing)existing.quantity=+existing.quantity+1;else this.cart.push({product_id:p.id,name:p.name,price:p.price,tax_rate:p.tax_rate,quantity:1});}
  scan(){const p=this.products.find((p:any)=>p.sku===this.search);if(p){this.add(p);this.search='';}}
  resetCart(){this.cartKey=crypto.randomUUID();this.cart=[];this.label='Mostrador';this.tableNumber=null;this.customerId=null;this.notes='';this.discount=0;this.sourceChannel='pos';this.fulfillment='dine_in';this.externalOrderId='';this.editingOrder=0;this.approvalEmail='';this.approvalPin='';this.adjustmentReason='';}
  useTable(n:number){const order=this.pending.find((o:any)=>o.table_number===n);if(order){this.edit(order);return;}this.resetCart();this.tableNumber=n;this.label='Mesa '+n;this.tab='sale';}
  occupied(n:number){return this.pending.some((o:any)=>o.table_number===n);}
  edit(o:any){if(!['open','queued'].includes(o.status)){this.tab='orders';return;}this.editingOrder=o.id;this.editingRevision=o.revision;this.sourceChannel=o.source_channel||'pos';this.fulfillment=o.fulfillment||'dine_in';this.externalOrderId=o.external_id||'';this.cart=o.items.map((i:any)=>({...i,quantity:+i.quantity}));this.label=o.label;this.tableNumber=o.table_number;this.customerId=o.customer_id;this.notes=o.notes;this.discount=+o.discount;this.tab='sale';}
  async saveOrder(checkout=false,sendKitchen=false){await this.run(async()=>{if(!this.cart.length)throw Error('Agregá al menos un producto.');if(this.cart.some(i=>!Number.isFinite(+i.quantity)||+i.quantity<=0||+i.quantity>999999))throw Error('Indicá una cantidad válida mayor que cero.');const body={expected_revision:this.editingOrder?this.editingRevision:null,request_key:this.cartKey,source_channel:this.sourceChannel,fulfillment:this.fulfillment,label:this.label,table_number:this.tableNumber?+this.tableNumber:null,customer_id:this.customerId?+this.customerId:null,notes:this.notes,discount:+this.discount,send_to_kitchen:sendKitchen,adjustment_reason:this.adjustmentReason,approval:this.needsApproval&&!this.rights.manage?{email:this.approvalEmail,pin:this.approvalPin}:null,items:this.cart.map(i=>({product_id:i.product_id,quantity:+i.quantity,unit_price:+i.price}))};const o=await this.mutate('/orders'+(this.editingOrder?'/'+this.editingOrder:''),body,this.editingOrder?'PUT':'POST');this.resetCart();this.tab='orders';this.notice=(sendKitchen?'Comanda enviada a cocina #':'Pedido guardado #')+o.id;if(checkout)this.openPayment(o);});this.approvalPin='';}
  async transition(o:any,status:string){if(status==='cancelled'&&!confirm('¿Cancelar este pedido?'))return;await this.run(async()=>{await this.mutate('/orders/'+o.id+'/status',{status});});}
  openPayment(o:any){this.paymentOrder=o;this.method='cash';this.received=+o.total;}
  async pay(){await this.run(async()=>{const o=await this.mutate('/orders/'+this.paymentOrder.id+'/pay',{method:this.method,received:+this.received});this.paymentOrder=null;this.receipt=o;this.notice='Venta registrada. Inventario actualizado.';});}
  async refund(o:any){const reason=prompt('Motivo de devolución total (reintegra todas las existencias):');if(!reason)return;await this.run(async()=>{await this.mutate('/orders/'+o.id+'/refund',{reason});this.notice='Devolución registrada. Realizá el reintegro al cliente por '+this.paymentName(o.payment_method)+'.';});}
  print(){window.print();}
  showComanda(o:any){this.receipt=null;this.comanda=o;}
  editProduct(p:any){this.productId=p.id;this.product={...this.blankProduct()};for(const k of Object.keys(this.product))this.product[k]=p[k];this.tab='products';}
  async saveProduct(){await this.run(async()=>{await this.mutate('/products'+(this.productId?'/'+this.productId:''),this.product,this.productId?'PUT':'POST');this.product=this.blankProduct();this.productId=0;this.notice='Producto guardado. Cargá sus existencias en Inventario.';});}
  async saveStock(){await this.run(async()=>{const {product_id,...p}=this.stockForm;await this.mutate('/products/'+product_id+'/stock',p);this.stockForm={product_id:0,kind:'entry',quantity:0,reason:''};this.notice='Inventario actualizado.';});}
  editCustomer(c:any){this.customerEdit=c.id;this.customer={name:c.name,phone:c.phone,email:c.email};}
  async saveCustomer(){await this.run(async()=>{await this.mutate('/customers'+(this.customerEdit?'/'+this.customerEdit:''),this.customer,this.customerEdit?'PUT':'POST');this.customerEdit=0;this.customer={name:'',phone:'',email:''};this.notice='Cliente guardado.';});}
  async cashAction(close=false){if(close&&!confirm('¿Cerrar la caja con el efectivo contado indicado?'))return;await this.run(async()=>{const r=await this.mutate('/register/'+(close?'close':'open'),{amount:+this.cashAmount});this.cashAmount=0;this.notice=close?'Caja cerrada. Diferencia: '+this.money(r.difference):'Caja abierta.';});}
  async saveCash(){await this.run(async()=>{await this.mutate('/cash',this.cashForm);this.cashForm={kind:'expense',amount:0,reason:''};this.notice='Movimiento registrado.';});}
  async loadReport(){await this.run(async()=>{this.report=await this.request(this.path('/reports')+'?start='+this.start+'&end='+this.end);});}
  exportCSV(){if(!this.report)return;const rows=[['Venta','Fecha','Método','Subtotal','Descuento','Impuesto','Total'],...this.report.orders.map((o:any)=>[o.id,this.date(o.paid_at),this.paymentName(o.payment_method),o.subtotal,o.discount,o.tax,o.total])];const csv='\ufeff'+rows.map(r=>r.map((v:any)=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='ventas-'+this.start+'.csv';a.click();URL.revokeObjectURL(u);}
  async saveAppointment(){await this.run(async()=>{await this.mutate('/appointments'+(this.appointmentId?'/'+this.appointmentId:''),{...this.appointment,customer_id:+this.appointment.customer_id,at:new Date(this.appointment.at).toISOString()},this.appointmentId?'PUT':'POST');this.appointmentId=0;this.appointment={customer_id:0,title:'',at:'',status:'pending',notes:''};this.notice=this.tableReservations?'Reservación guardada.':'Cita guardada.';});}
  editAppointment(p:any){this.appointmentId=p.id;const d=new Date(p.at);this.appointment={customer_id:p.customer_id,title:p.title,at:new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16),status:p.status,notes:p.notes};const form=document.getElementById('pos-appointment-form');form?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});form?.querySelector<HTMLInputElement>('input[name="at"]')?.focus({preventScroll:true});}
  async changePassword(){await this.run(async()=>{const r=await this.request('/auth/password','POST',{current:this.currentPassword,password:this.nextPassword});this.token=r.token;sessionStorage.setItem('systemlab-pos-token',this.token);this.currentPassword='';this.nextPassword='';this.notice='Contraseña actualizada. Las sesiones anteriores quedaron cerradas.';});}
  async loadTeam(){await this.run(async()=>{this.team=await this.request(this.path('/team'));});}
  async saveStaff(){await this.run(async()=>{if(this.staff.password.trim().length<8)throw Error('La contraseña debe tener al menos 8 caracteres.');await this.request(this.path('/team'),'POST',this.staff);this.staff={name:'',email:'',password:'',role:'waiter',can_pay:true};this.team=await this.request(this.path('/team'));this.notice='Empleado creado con acceso a este local.';});}
  editStaff(u:any){this.staffEdit={...u};this.staffPassword='';}
  async saveStaffAccess(){await this.run(async()=>{await this.request(this.path('/team/'+this.staffEdit.id),'PUT',{role:this.staffEdit.role,can_pay:this.staffEdit.can_pay});this.staffEdit=null;this.team=await this.request(this.path('/team'));this.notice='Permisos actualizados para este local.';});}
  async connectStaff(){await this.run(async()=>{await this.request(this.path('/team/'+this.linkStaff),'PUT',{role:this.linkRole,can_pay:this.linkPay});this.linkStaff=0;this.team=await this.request(this.path('/team'));this.notice='Empleado vinculado a este local.';});}
  async removeStaff(u:any){if(!confirm('¿Retirar el acceso de '+u.name+' a este local? Sus ventas se conservan.'))return;await this.run(async()=>{await this.request(this.path('/team/'+u.id),'DELETE');this.staffEdit=null;this.team=await this.request(this.path('/team'));this.notice='Acceso retirado.';});}
  async resetStaffPassword(){await this.run(async()=>{await this.request(this.path('/team/'+this.staffEdit.id+'/password'),'POST',{password:this.staffPassword});this.staffPassword='';this.notice='Contraseña restablecida. Se cerraron sus sesiones y se desactivó su código de autorización.';});}
  async savePin(){await this.run(async()=>{await this.request(this.path('/pin'),'POST',{current_password:this.pinPassword,pin:this.pinCode});await this.refresh();this.notice='Código de autorización guardado para este local.';});this.pinPassword='';this.pinCode='';}
  async loadAudit(){await this.run(async()=>{this.auditRows=await this.request(this.path('/audit'));});}
  customerName(id:number){return this.data?.customers.find((c:any)=>c.id===id)?.name||'Consumidor final';}
  productName(id:number){return this.data?.products.find((p:any)=>p.id===id)?.name||'—';}
}
