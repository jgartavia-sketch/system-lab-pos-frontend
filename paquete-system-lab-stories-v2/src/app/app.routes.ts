import { Routes } from '@angular/router';

import { Landing } from './pages/landing/landing';
import { Pos } from './pages/pos/pos';
import { ClientControl } from './pages/client-control/client-control';
import { Stories } from './pages/stories/stories';

export const routes: Routes = [
  {
    path: 'admin/clientes',
    component: ClientControl,
    title: 'Control de clientes | System Lab',
  },
  {
    path: 'stories',
    component: Stories,
    title: 'System Lab Stories | Historias que se viven',
  },
  {
    path: '',
    component: Landing,
    title: 'System Lab | Sistemas que producen resultados reales',
  },
  {
    path: 'pos-internal',
    component: Pos,
    title: 'System Lab POS',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
