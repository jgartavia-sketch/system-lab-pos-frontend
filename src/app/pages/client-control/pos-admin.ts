import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pos-admin', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './pos-admin.html', styleUrl: './pos-admin.scss',
})
export class PosAdmin implements OnInit {
  @Input({ required: true }) api = '';
  token = sessionStorage.getItem('systemlab-pos-token') || '';
  account: any = null;
  adminData: any = null;
  loading = true;
  busy = false;
  error = '';
  notice = '';
  loginEmail = '';
  loginPassword = '';
  newBusiness = this.blankBusiness();
  businessEdit = 0;
  businessOwner = 0;
  newAccount = { name: '', email: '', password: '', business_ids: [] as number[] };
  shirleys = {name:'',email:'',password:'',business_name:'Shirley’s',tables:10};
  access: any = null;
  resetPassword = '';
  modes = [{id:'restaurante',name:'Restaurante'},{id:'heladeria',name:'Heladería'},{id:'supermercado',name:'Supermercado'},{id:'taller',name:'Taller mecánico'},{id:'salon',name:'Salón de belleza'}];

  constructor(private cd: ChangeDetectorRef) {}
  ngOnInit() { void this.initialize(); }
  blankBusiness() { return {name:'',mode:'restaurante',tables:10,active:true}; }
  modeName(mode: string) { return this.modes.find(m => m.id === mode)?.name || mode; }
  localsFor(user: any): any[] { return this.adminData?.businesses.filter((b: any) => user.business_ids.includes(b.id)) || []; }

  private clearSession() {
    this.token = ''; this.account = null; this.adminData = null; this.access = null;
    this.resetPassword = ''; this.newAccount.password = '';
    this.shirleys.password = '';
    sessionStorage.removeItem('systemlab-pos-token');
  }
  async request(path: string, method = 'GET', body?: any) {
    const ctl = new AbortController(); const timeout = setTimeout(() => ctl.abort(), 45000);
    try {
      const response = await fetch(this.api + path, { method, headers: {'Content-Type':'application/json', ...(this.token ? {Authorization:'Bearer ' + this.token} : {})}, ...(body !== undefined ? {body:JSON.stringify(body)} : {}), signal:ctl.signal });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) this.clearSession();
        if (response.status === 403) this.adminData = null;
        throw Error(typeof data.detail === 'string' ? data.detail : 'Revisá los campos del formulario.');
      }
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') throw Error('La conexión tardó demasiado. Volvé a intentarlo.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async run(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true; this.error = ''; this.notice = '';
    try { await action(); } catch (error: any) { this.error = error.message || 'No se pudo completar la operación.'; }
    finally { this.busy = false; this.cd.detectChanges(); }
  }
  async initialize() {
    await this.run(async () => {
      if (!this.token) return;
      const me = await this.request('/auth/me'); this.account = me.account;
      if (this.account.ceo) this.adminData = await this.request('/admin');
    });
    this.loading = false; this.cd.detectChanges();
  }
  async login() {
    await this.run(async () => {
      const result = await this.request('/auth/login', 'POST', {email:this.loginEmail, password:this.loginPassword});
      this.token = result.token; this.account = result.account; this.loginPassword = '';
      sessionStorage.setItem('systemlab-pos-token', this.token);
      if (this.account.ceo) this.adminData = await this.request('/admin');
    });
  }
  async logout() {
    await this.run(async () => { try { await this.request('/auth/logout', 'POST'); } finally { this.clearSession(); } });
  }
  newLocalFor(user: any) {
    this.businessEdit = 0; this.newBusiness = this.blankBusiness(); this.businessOwner = user.id;
    this.notice = 'Nuevo local para ' + user.name + '. Completá el formulario de locales.';
    document.getElementById('pos-business-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  editBusiness(business: any) {
    this.businessEdit = business.id;
    this.newBusiness = {name:business.name,mode:business.mode,tables:business.tables,active:business.active};
    document.getElementById('pos-business-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  cancelBusiness() { this.businessEdit = 0; this.businessOwner = 0; this.newBusiness = this.blankBusiness(); }
  async saveBusiness() {
    await this.run(async () => {
      const path = this.businessEdit ? '/admin/businesses/' + this.businessEdit : this.businessOwner ? '/admin/accounts/' + this.businessOwner + '/businesses' : '/admin/businesses';
      await this.request(path, this.businessEdit ? 'PUT' : 'POST', this.newBusiness);
      const assigned = !this.businessEdit && !!this.businessOwner;
      this.cancelBusiness(); this.adminData = await this.request('/admin');
      this.notice = assigned ? 'Local creado y asignado. El cliente conserva sus otros locales.' : 'Local guardado.';
    });
  }
  toggleBusiness(target: any, id: number) {
    target.business_ids = target.business_ids.includes(id) ? target.business_ids.filter((v: number) => v !== id) : [...target.business_ids, id];
  }
  async saveAccount() {
    await this.run(async () => {
      if (this.newAccount.password.trim().length < 8) throw Error('La contraseña debe tener al menos 8 caracteres.');
      const user = await this.request('/admin/accounts', 'POST', this.newAccount);
      this.newAccount = {name:'',email:'',password:'',business_ids:[]};
      this.businessOwner = user.id;
      this.adminData = await this.request('/admin');
      this.notice = 'Cuenta creada. Podés asignarle más locales desde este panel.';
    });
  }
  async setupShirleys() {
    await this.run(async () => {
      const result = await this.request('/admin/shirleys', 'POST', this.shirleys);
      this.shirleys.password = '';
      this.adminData = await this.request('/admin');
      this.notice = result.created === false ? 'Shirley’s ya estaba configurado. Se conservaron su cuenta y catálogo.' : `Shirley’s creado con ${result.products} productos, sus categorías y los cargos de empaque. La cuenta ya puede ingresar al POS.`;
    });
  }
  editAccess(user: any) { this.resetPassword = ''; this.access = {...user, business_ids:[...user.business_ids]}; this.cd.detectChanges(); document.getElementById('pos-access-form')?.scrollIntoView({behavior:'smooth',block:'start'}); }
  async saveAccess() {
    await this.run(async () => {
      const self = this.access.id === this.account.id;
      await this.request('/admin/accounts/' + this.access.id, 'PUT', {active:this.access.active, business_ids:this.access.business_ids});
      this.access = null;
      if (self) { this.clearSession(); this.notice = 'Acceso actualizado. Volvé a ingresar.'; }
      else { this.adminData = await this.request('/admin'); this.notice = 'Locales y acceso actualizados. El cliente debe volver a ingresar.'; }
    });
  }
  async deleteAccount(user: any) {
    if (user.ceo) return;
    const answer = confirm(`Â¿Eliminar definitivamente la cuenta de ${user.name} (${user.email})?` +
      "\n\nSolo se eliminarÃ¡ si todavÃ­a no tiene historial operativo. Esta acciÃ³n no se puede deshacer.");
    if (!answer) return;
    await this.run(async () => {
      await this.request('/admin/accounts/' + user.id, 'DELETE');
      if (this.access?.id === user.id) this.access = null;
      this.adminData = await this.request('/admin');
      this.notice = 'Cuenta eliminada correctamente.';
    });
  }
  async resetAccountPassword() {
    await this.run(async () => {
      if (this.resetPassword.trim().length < 8) throw Error('La contraseña debe tener al menos 8 caracteres.');
      const self = this.access.id === this.account.id;
      await this.request('/admin/accounts/' + this.access.id + '/password', 'POST', {password:this.resetPassword});
      this.resetPassword = '';
      if (self) this.clearSession();
      this.notice = 'Contraseña restablecida. Las sesiones anteriores quedaron cerradas.';
    });
  }
}
