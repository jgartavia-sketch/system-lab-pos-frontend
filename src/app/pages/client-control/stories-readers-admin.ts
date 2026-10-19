import {CommonModule} from '@angular/common';
import {HttpClient, HttpHeaders, HttpErrorResponse} from '@angular/common/http';
import {Component, Input, OnInit, OnDestroy, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Subscription} from 'rxjs';

export interface AdminStoriesReader {
  id: number; full_name: string; email: string; phone: string;
  is_active: boolean; created_at: string; last_login_at: string | null;
}
export interface AdminStoriesReadersPage { total: number; filtered_total: number; items: AdminStoriesReader[]; }

@Component({selector: 'app-stories-readers-admin', imports:[CommonModule, FormsModule], templateUrl:'./stories-readers-admin.html', styleUrl:'./stories-readers-admin.scss'})
export class StoriesReadersAdmin implements OnInit, OnDestroy {
  @Input({required:true}) apiBase = '';
  private readonly http = inject(HttpClient);
  private request?: Subscription;
  private loginRequest?: Subscription;
  readonly data = signal<AdminStoriesReadersPage | null>(null);
  readonly loading = signal(false);
  readonly deleting = signal<number | null>(null);
  readonly signingIn = signal(false);
  readonly needsLogin = signal(false);
  readonly error = signal('');
  readonly pageSize = 25;
  offset = 0; search = ''; private appliedSearch = '';
  email = ''; password = '';
  ngOnInit(): void {this.load();}
  ngOnDestroy(): void {this.request?.unsubscribe(); this.loginRequest?.unsubscribe();}
  private headers(): HttpHeaders {return new HttpHeaders({Authorization:'Bearer '+(sessionStorage.getItem('systemlab-pos-token') || '')});}
  load(): void {
    this.request?.unsubscribe(); this.error.set('');
    if(!sessionStorage.getItem('systemlab-pos-token')) {this.needsLogin.set(true); this.data.set(null); this.loading.set(false); return;}
    this.loading.set(true);
    this.request=this.http.get<AdminStoriesReadersPage>(this.apiBase+'/stories/admin/readers', {
      headers:this.headers(), params:{q:this.appliedSearch,offset:this.offset,limit:this.pageSize}
    }).subscribe({next:page=>{
      if(this.offset && this.offset>=page.filtered_total){this.offset=0; this.load(); return;}
      this.data.set(page); this.needsLogin.set(false); this.loading.set(false);
    },error:(e: HttpErrorResponse)=>{
      this.loading.set(false); this.data.set(null);
      this.needsLogin.set(e.status===401 || e.status===403);
      this.error.set(e.status===403 ? 'Esta lista está reservada a la cuenta administradora de System Lab.' : e.status===401 ? 'Ingresá con tu cuenta administradora para ver los lectores.' : 'No se pudo cargar la lista. Intentá nuevamente.');
    }});
  }
  filter(): void {this.offset=0; this.appliedSearch=this.search.trim(); this.load();}
  previous(): void {if(this.offset>=this.pageSize){this.offset-=this.pageSize;this.load();}}
  next(): void {if(this.offset+this.pageSize<(this.data()?.filtered_total ?? 0)){this.offset+=this.pageSize;this.load();}}
  refresh(): void {this.load();}
  login(): void {
    if(this.signingIn() || !this.email.trim() || !this.password) return;
    this.signingIn.set(true); this.error.set('');
    this.loginRequest=this.http.post<{token:string;account:{ceo:boolean}}>(this.apiBase+'/pos-api/auth/login',{email:this.email.trim(),password:this.password}).subscribe({
      next:result=>{
        this.password=''; this.signingIn.set(false);
        if(!result.account.ceo){this.error.set('Necesitás la cuenta administradora de System Lab.'); return;}
        sessionStorage.setItem('systemlab-pos-token',result.token); this.offset=0; this.load();
      },error:(e: HttpErrorResponse)=>{
        this.password=''; this.signingIn.set(false);
        this.error.set(typeof e.error?.detail==='string' ? e.error.detail : 'No se pudo iniciar sesión. Intentá nuevamente.');
      }
    });
  }
  deleteReader(reader: AdminStoriesReader): void {
    if(this.deleting() !== null) return;
    if(!confirm('¿Eliminar definitivamente a '+reader.full_name+' ('+reader.email+')? Se eliminarán su cuenta, referidos, recompensas y comentarios, incluidas las respuestas dependientes. Esta acción no se puede deshacer.')) return;
    this.deleting.set(reader.id); this.error.set('');
    this.loginRequest=this.http.delete(this.apiBase+'/stories/admin/readers/'+reader.id,{headers:this.headers()}).subscribe({
      next:()=>{this.deleting.set(null);this.load();},
      error:(e:HttpErrorResponse)=>{this.deleting.set(null);this.error.set(typeof e.error?.detail==='string' ? e.error.detail : 'No se pudo eliminar el lector. Revisá tu sesión administradora.');}
    });
  }
  end(): number {return Math.min(this.offset+this.pageSize,this.data()?.filtered_total ?? 0);}
}
