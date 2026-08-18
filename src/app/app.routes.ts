import { Routes } from '@angular/router';

import { Landing } from './pages/landing/landing';
import { Pos } from './pages/pos/pos';

export const routes: Routes = [
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