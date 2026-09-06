import { Routes } from '@angular/router';

import { Landing } from './pages/landing/landing';
import { ClientControl } from './pages/client-control/client-control';
import { Stories } from './pages/stories/stories';
import { StoriesAccount } from './pages/stories-account/stories-account';
import { StoriesPublish } from './pages/stories-publish/stories-publish';
import { StoriesReader } from './pages/stories-reader/stories-reader';

export const routes: Routes = [
  { path: 'pos', loadComponent: () => import('./pages/pos-hub/pos-hub').then(m => m.PosHub), title: 'System Lab POS' },
  { path: 'pos/:mode', loadComponent: () => import('./pages/pos-hub/pos-hub').then(m => m.PosHub), title: 'Ingresar | System Lab POS' },
  {
    path: 'stories/leer/:storySlug/:season/:chapter',
    component: StoriesReader,
    title: 'Lector | System Lab Stories',
  },
  {
    path: 'admin/clientes',
    component: ClientControl,
    title: 'Control de clientes | System Lab',
  },
  {
    path: 'stories/mi-cuenta',
    component: StoriesAccount,
    title: 'Mi cuenta | System Lab Stories',
  },
  {
    path: 'stories/publicar',
    component: StoriesPublish,
    title: 'Publicar mi historia | System Lab Stories',
  },
  {
    path: 'stories',
    component: Stories,
    title: 'The Voyager Space Hotel | System Lab Stories',
  },
  {
    path: '',
    component: Landing,
    title: 'System Lab | Sistemas que producen resultados reales',
  },
  {
    path: 'pos-internal',
    redirectTo: 'pos',
    pathMatch: 'full',
    title: 'System Lab POS',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
