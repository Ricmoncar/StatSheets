import { Routes } from '@angular/router';

// One route per page of the old site. Pages not ported yet show a placeholder
// that says so, rather than a blank screen.
const todo = (title: string) => ({
  loadComponent: () => import('./features/not-ported/not-ported').then(m => m.NotPorted),
  data: { title },
  title: `STATSHEETS - ${title}`,
});

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/main/main-page').then(m => m.MainPage), title: 'STATSHEETS' },
  { path: 'c/:id', loadComponent: () => import('./features/main/main-page').then(m => m.MainPage), title: 'STATSHEETS' },
  { path: 'utilities', ...todo('UTILITIES') },
  { path: 'gallery', ...todo('GALLERY') },
  { path: 'encyclopedia', ...todo('ENCYCLOPAEDIA') },
  { path: 'playlists', ...todo('PLAYLISTS') },
  { path: 'bkscorner', ...todo("BK'S CORNER") },
  { path: 'baddie', ...todo('SPIN A BADDIE') },
  { path: 'admin', ...todo('ADMIN') },
  { path: '**', redirectTo: '' },
];
