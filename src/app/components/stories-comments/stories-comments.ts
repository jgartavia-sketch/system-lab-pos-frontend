import {Component, OnInit, inject, signal} from '@angular/core';
import {DatePipe, NgTemplateOutlet} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {StoriesAuthService, StoryComment} from '../../services/stories-auth.service';

@Component({selector: 'app-stories-comments', imports: [FormsModule, RouterLink, DatePipe, NgTemplateOutlet], templateUrl: './stories-comments.html', styleUrl: './stories-comments.scss'})
export class StoriesComments implements OnInit {
  readonly auth = inject(StoriesAuthService);
  readonly comments = signal<StoryComment[]>([]);
  readonly replies = signal<Record<number, StoryComment[]>>({});
  readonly expanded = signal<Record<number, boolean>>({});
  readonly moreReplies = signal<Record<number, boolean>>({});
  readonly characters = signal<string[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly more = signal(false);
  readonly stars = [1,2,3,4,5];
  body = ''; rating = 0; anonymous = false; character = '';
  target: StoryComment | null = null;
  ngOnInit(): void {
    this.load();
    if(this.auth.hasSession()) this.auth.commentCapabilities().subscribe({next: c => this.characters.set(c.characters), error: () => {}});
  }
  load(append = false): void {
    this.loading.set(true);
    this.auth.listComments(null, append ? this.comments().length : 0).subscribe({
      next: rows => {this.comments.update(old => append ? [...old,...rows] : rows); this.more.set(rows.length === 20); this.loading.set(false);},
      error: () => {this.loading.set(false); this.message.set('No se pudieron cargar las opiniones. Intentá nuevamente.');}
    });
  }
  showReplies(c: StoryComment, append = false): void {
    if(!append && this.expanded()[c.id]) {this.expanded.update(v => ({...v,[c.id]:false})); return;}
    const offset = append ? (this.replies()[c.id]?.length ?? 0) : 0;
    this.auth.listComments(c.id, offset).subscribe({next: rows => {
      this.replies.update(v => ({...v,[c.id]: append ? [...(v[c.id] ?? []),...rows] : rows}));
      this.expanded.update(v => ({...v,[c.id]:true}));
      this.moreReplies.update(v => ({...v,[c.id]:rows.length === 20}));
    }, error: () => this.message.set('No se pudieron cargar las respuestas.')});
  }
  reply(c: StoryComment): void {this.target = c; this.character = ''; this.message.set(''); document.getElementById('stories-comment-body')?.focus();}
  cancel(): void {this.target = null; this.character = '';}
  submit(): void {
    if(this.busy()) return;
    if(!this.body.trim() || (!this.target && !this.rating)) {this.message.set('Escribí tu comentario y seleccioná de 1 a 5 estrellas.'); return;}
    this.busy.set(true); this.message.set('');
    const target = this.target;
    this.auth.postComment({body:this.body.trim(), anonymous:this.character ? false : this.anonymous,
      ...(target ? {parent_id:target.id} : {rating:this.rating}), ...(target && this.character ? {character:this.character} : {})}).subscribe({
      next: row => {
        if(target) {
          this.replies.update(v => ({...v,[target.id]:[row,...(v[target.id] ?? []).filter(r=>r.id!==row.id)]}));
          this.expanded.update(v => ({...v,[target.id]:false}));
          this.showReplies(target);
        } else this.load();
        this.body = ''; this.rating = 0; this.cancel(); this.busy.set(false); this.message.set('Tu comentario fue publicado.');
      }, error: e => {this.busy.set(false); this.message.set(typeof e.error?.detail === 'string' ? e.error.detail : 'No se pudo publicar. Revisá tu sesión e intentá nuevamente.');}
    });
  }
  avatar(name: string): string {
    const files: Record<string,string> = {Andrew:'andrew-horizon-academy', Frank:'frank-horizon-academy', Jenni:'jenni-horizon-academy', Wilber:'wilber-horizon-academy', Charlie:'charlie-horizon-academy', Jey:'jey'};
    return '/images/voyager/characters/' + files[name] + '.webp';
  }
}
