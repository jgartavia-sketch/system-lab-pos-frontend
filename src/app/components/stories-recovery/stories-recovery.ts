import {Component, OnInit, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {StoriesAuthService} from '../../services/stories-auth.service';

@Component({selector:'app-stories-recovery',imports:[FormsModule],templateUrl:'./stories-recovery.html',styleUrl:'./stories-recovery.scss'})
export class StoriesRecovery implements OnInit {
  private readonly auth=inject(StoriesAuthService);
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);
  private token='';
  readonly open=signal(false);readonly resetting=signal(false);readonly busy=signal(false);
  readonly message=signal('');readonly error=signal('');
  email='';password='';confirmation='';
  ngOnInit(): void {
    this.token=this.route.snapshot.queryParamMap.get('reset') || '';
    if(this.token){this.open.set(true);this.resetting.set(true);
      // Retirar el enlace sensible del historial tras capturarlo.
      void this.router.navigate([], {relativeTo:this.route,queryParams:{reset:null},queryParamsHandling:'merge',replaceUrl:true});
    }
  }
  show():void {this.open.set(true);this.message.set('');this.error.set('');}
  requestNew():void {this.resetting.set(false);this.token='';this.password='';this.confirmation='';this.message.set('');this.error.set('');}
  submit():void {
    if(this.busy())return;
    this.error.set('');this.message.set('');
    if(this.resetting()){
      if(this.password.length<8 || this.password.length>72){this.error.set('Usá entre 8 y 72 caracteres.');return;}
      if(this.password!==this.confirmation){this.error.set('Las contraseñas no coinciden.');return;}
      this.busy.set(true);
      this.auth.resetPassword(this.token,this.password).subscribe({next:r=>{
        this.auth.logout();this.token='';this.password='';this.confirmation='';this.resetting.set(false);this.busy.set(false);this.message.set(r.message);
      },error:e=>{this.busy.set(false);this.error.set(typeof e.error?.detail==='string' ? e.error.detail : 'No se pudo restablecer la contraseña. Solicitá un enlace nuevo.');}});
    }else{
      if(!this.email.trim())return;
      this.busy.set(true);
      this.auth.forgotPassword(this.email.trim()).subscribe({next:r=>{this.busy.set(false);this.message.set(r.message);},error:e=>{this.busy.set(false);this.error.set(typeof e.error?.detail==='string' ? e.error.detail : 'No se pudo solicitar el enlace. Intentá nuevamente.');}});
    }
  }
}
