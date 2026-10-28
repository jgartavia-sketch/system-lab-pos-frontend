import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({selector:'app-pos-admin',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./pos-admin.html',styleUrl:'./pos-admin.scss'})
export class PosAdmin implements OnInit {
  @Input({required:true}) api='';
  token=sessionStorage.getItem('systemlab-pos-token')||'';
  account:any=null;adminData:any=null;loading=true;busy=false;error='';notice='';
  loginEmail='';loginPassword='';email='';password='';confirmation='';showPassword=false;showConfirmation=false;showLogin=false;
  search='';
  constructor(private cd:ChangeDetectorRef){}
  ngOnInit(){void this.initialize();}
  modeName(mode:string){return ({restaurante:'Restaurante',heladeria:'Heladería',supermercado:'Supermercado',taller:'Taller mecánico',salon:'Salón de belleza'} as any)[mode]||mode;}
  filter='all';
  get allCustomers(){return (this.adminData?.accounts||[]).filter((u:any)=>!u.ceo);}
  localsFor(u:any){return (this.adminData?.businesses||[]).filter((b:any)=>(u.business_ids||[]).includes(b.id));}
  clientName(u:any){return this.localsFor(u)[0]?.name||u.name||u.email;}
  clientStatus(u:any){if(u.archived)return 'retired';if(!u.active||this.localsFor(u).some((b:any)=>!b.active))return 'suspended';return 'active';}
  statusLabel(u:any){return ({active:'Activo',suspended:'Suspendido',retired:'Eliminado'} as any)[this.clientStatus(u)];}
  count(status:string){return this.allCustomers.filter((u:any)=>this.clientStatus(u)===status).length;}
  get customers(){const q=this.search.trim().toLowerCase();return this.allCustomers.filter((u:any)=>(this.filter==='all'? !u.archived:this.clientStatus(u)===this.filter)&&(!q||(u.name+' '+u.email+' '+this.localsFor(u).map((b:any)=>b.name).join(' ')).toLowerCase().includes(q)));}
  get existingClient(){return this.allCustomers.find((u:any)=>u.email.toLowerCase()===this.email.trim().toLowerCase());}
  initials(u:any){return this.clientName(u).split(/\s+/).slice(0,2).map((w:string)=>w[0]).join('').toUpperCase();}
  connected(u:any){return this.localsFor(u).some((b:any)=>!!b.connection_provider);}
  setFilter(value:string){this.filter=value;}
  cancelEditing(){this.email='';this.clearPasswords();}
  private clearSession(){this.token='';this.account=null;this.adminData=null;this.clearPasswords();sessionStorage.removeItem('systemlab-pos-token');}
  clearPasswords(){this.password='';this.confirmation='';this.showPassword=false;this.showConfirmation=false;this.loginPassword='';}
  async request(path:string,method='GET',body?:any){
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),45000);
    try{const r=await fetch(this.api+path,{method,headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:ctl.signal});
      const raw=await r.text();let data:any;try{data=JSON.parse(raw);}catch{throw Error('El servidor no respondió correctamente. Reintentá en unos segundos.');}
      if(!r.ok){if(r.status===401)this.clearSession();throw Error(typeof data.detail==='string'?data.detail:'Revisá el correo y los campos del formulario.');}return data;
    }catch(e:any){if(e.name==='AbortError')throw Error('La conexión tardó demasiado. Reintentá.');throw e;}finally{clearTimeout(timer);}
  }
  async run(action:()=>Promise<void>){if(this.busy)return;this.busy=true;this.error='';this.notice='';try{await action();}catch(e:any){this.error=e.message||'No se pudo completar la operación.';}finally{this.busy=false;this.cd.detectChanges();if(this.error)document.getElementById('pos-admin-error')?.scrollIntoView({behavior:'smooth',block:'center'});}}
  async initialize(){await this.run(async()=>{if(!this.token)return;const me=await this.request('/auth/me');this.account=me.account;if(this.account.ceo)this.adminData=await this.request('/admin');});this.loading=false;this.cd.detectChanges();}
  async login(){await this.run(async()=>{const r=await this.request('/auth/login','POST',{email:this.loginEmail,password:this.loginPassword});this.token=r.token;this.account=r.account;sessionStorage.setItem('systemlab-pos-token',this.token);this.loginPassword='';if(this.account.ceo)this.adminData=await this.request('/admin');});}
  async logout(){await this.run(async()=>{try{await this.request('/auth/logout','POST');}finally{this.clearSession();}});}
  async activatePos(){
    await this.run(async()=>{
      if(this.password!==this.confirmation)throw Error('Las contraseñas no coinciden.');
      if(this.password.trim().length<8)throw Error('La contraseña debe tener al menos 8 caracteres.');
      const email=this.email.trim().toLowerCase();const existing=this.adminData?.accounts.find((u:any)=>u.email.toLowerCase()===email);
      if(existing&&!confirm(`La cuenta ${email} ya existe. Se activará y se reemplazará su contraseña. Su POS se habilitará y su historial se conserva. ¿Continuar?`))return;
      await this.request('/admin/activate-pos','POST',{email,password:this.password,confirmation:this.confirmation});
      this.clearPasswords();this.adminData=await this.request('/admin');
      this.filter='all';this.notice=`Cliente activado: ${email}. Ya puede ingresar en systemlabcr.com/pos.`;
    });
  }
  prepareAccess(u:any){this.email=u.email;this.clearPasswords();document.getElementById('pos-activate-form')?.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('pos-owner-password')?.focus();}
  async suspend(u:any){if(!confirm(`¿Suspender el POS de ${u.email} y el acceso de su equipo? Su historial se conserva.`))return;await this.run(async()=>{await this.request('/admin/accounts/'+u.id+'/subscription','PUT',{active:false});this.adminData=await this.request('/admin');this.notice='Cliente y su POS suspendidos. Sus datos se conservaron.';});}
  async resume(u:any){if(!confirm(`¿Reactivar el POS de ${u.email} y su negocio? Conserva su contraseña.`))return;await this.run(async()=>{await this.request('/admin/accounts/'+u.id+'/subscription','PUT',{active:true});this.adminData=await this.request('/admin');this.notice='POS reactivado. Conserva su contraseña.';});}
  async deleteAccount(u:any){if(!confirm(`¿Eliminar el acceso de ${u.email}? Se retirará de la lista y se bloqueará su POS, incluidos sus empleados. Su historial contable se conserva. Podés restaurarlo luego con Activar POS.`))return;await this.run(async()=>{await this.request('/admin/accounts/'+u.id+'/subscription','DELETE');this.adminData=await this.request('/admin');this.notice='Cliente y su POS eliminados del panel activo. El historial se conservó.';});}
}
