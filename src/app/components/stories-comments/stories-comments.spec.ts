import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of, throwError, Subject} from 'rxjs';
import {StoriesComments} from './stories-comments';
import {StoriesAuthService, StoryComment} from '../../services/stories-auth.service';

const row: StoryComment = {id:1,parent_id:null,body:'Una historia que atrapa',rating:4,author_name:'Anónimo',character:null,created_at:'2026-10-19T12:00:00Z'};

describe('Opiniones de Stories', () => {
  const api = {hasSession:vi.fn(), listComments:vi.fn(), commentCapabilities:vi.fn(), postComment:vi.fn()};
  beforeEach(async () => {
    vi.resetAllMocks();
    api.hasSession.mockReturnValue(true); api.listComments.mockReturnValue(of([row])); api.commentCapabilities.mockReturnValue(of({characters:[]}));
    await TestBed.configureTestingModule({imports:[StoriesComments], providers:[provideRouter([]), {provide:StoriesAuthService,useValue:api}]}).compileComponents();
  });
  it('muestra la opinión anónima y las estrellas sin interpretar HTML', () => {
    api.listComments.mockReturnValue(of([{...row,body:'<script>alert(1)</script>'}]));
    const f=TestBed.createComponent(StoriesComments); f.detectChanges();
    expect(f.nativeElement.querySelector('.comment strong').textContent).toBe('Anónimo');
    expect(f.nativeElement.querySelectorAll('.rating .selected').length).toBe(4);
    expect(f.nativeElement.querySelector('.comment script')).toBeNull();
    expect(f.nativeElement.querySelector('.body').textContent).toContain('<script>');
  });
  it('requiere estrellas y evita envíos duplicados mientras publica', () => {
    const f=TestBed.createComponent(StoriesComments); f.detectChanges(); const c=f.componentInstance;
    c.body='Buena lectura'; c.submit(); expect(api.postComment).not.toHaveBeenCalled();
    c.rating=5; c.anonymous=true; api.postComment.mockReturnValue(new Subject()); c.submit(); c.submit();
    expect(api.postComment).toHaveBeenCalledTimes(1);
    expect(api.postComment).toHaveBeenCalledWith({body:'Buena lectura',rating:5,anonymous:true});
  });
  it('responde con personaje sin enviar estrellas ni anonimato', () => {
    api.commentCapabilities.mockReturnValue(of({characters:['Andrew']})); api.postComment.mockReturnValue(of({...row,id:2,parent_id:1,rating:null,character:'Andrew',author_name:'Andrew'}));
    const f=TestBed.createComponent(StoriesComments); f.detectChanges(); const c=f.componentInstance;
    c.reply(row); c.body='Bienvenido'; c.character='Andrew'; c.anonymous=true; c.submit();
    expect(api.postComment).toHaveBeenCalledWith({body:'Bienvenido',parent_id:1,anonymous:false,character:'Andrew'});
  });
  it('conserva el texto al fallar y permite reintentar', () => {
    api.postComment.mockReturnValue(throwError(()=>({error:{detail:'Sesión vencida'}})));
    const f=TestBed.createComponent(StoriesComments); f.detectChanges(); const c=f.componentInstance;
    c.body='Mi opinión'; c.rating=3; c.submit(); expect(c.body).toBe('Mi opinión'); expect(c.busy()).toBe(false); expect(c.message()).toBe('Sesión vencida');
  });
  it('invita a iniciar sesión y no muestra formulario al visitante', () => {
    api.hasSession.mockReturnValue(false); const f=TestBed.createComponent(StoriesComments); f.detectChanges();
    expect(f.nativeElement.querySelector('form')).toBeNull(); expect(f.nativeElement.textContent).toContain('Ingresá o registrate');
  });
});
