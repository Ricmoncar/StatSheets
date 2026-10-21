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
  { path: 'new', loadComponent: () => import('./features/editor/character-editor').then(m => m.CharacterEditor), title: 'STATSHEETS - NEW CHARACTER' },
  { path: 'edit/:id', loadComponent: () => import('./features/editor/character-editor').then(m => m.CharacterEditor), title: 'STATSHEETS - EDIT' },
  { path: 'utilities', loadComponent: () => import('./features/utilities/utilities-page').then(m => m.UtilitiesPage), title: 'STATSHEETS - UTILITIES' },
  { path: 'gallery', loadComponent: () => import('./features/gallery/gallery-page').then(m => m.GalleryPage), title: 'STATSHEETS - GALLERY' },
  { path: 'encyclopedia', ...todo('ENCYCLOPAEDIA') },
  { path: 'playlists', loadComponent: () => import('./features/playlists/playlists-page').then(m => m.PlaylistsPage), title: 'STATSHEETS - PLAYLISTS' },
  { path: 'bkscorner', ...todo("BK'S CORNER") },
  { path: 'baddie', ...todo('SPIN A BADDIE') },
  { path: 'admin', loadComponent: () => import('./features/admin/admin-page').then(m => m.AdminPage), title: 'STATSHEETS - ADMIN' },
  { path: '**', redirectTo: '' },
];
