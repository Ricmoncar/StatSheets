import { Routes } from '@angular/router';
import { ENCYCLOPEDIA_PAGE, toOldPage } from './core/pages';

// One route per page of the old site.
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/main/main-page').then(m => m.MainPage), title: 'STATSHEETS' },
  { path: 'c/:id', loadComponent: () => import('./features/main/main-page').then(m => m.MainPage), title: 'STATSHEETS' },
  { path: 'new', loadComponent: () => import('./features/editor/character-editor').then(m => m.CharacterEditor), title: 'STATSHEETS - NEW CHARACTER' },
  { path: 'edit/:id', loadComponent: () => import('./features/editor/character-editor').then(m => m.CharacterEditor), title: 'STATSHEETS - EDIT' },
  { path: 'utilities', loadComponent: () => import('./features/utilities/utilities-page').then(m => m.UtilitiesPage), title: 'STATSHEETS - UTILITIES' },
  { path: 'gallery', loadComponent: () => import('./features/gallery/gallery-page').then(m => m.GalleryPage), title: 'STATSHEETS - GALLERY' },
  // the Encyclopaedia stays the old page for now; its address leads there
  { path: 'encyclopedia', canActivate: [toOldPage(ENCYCLOPEDIA_PAGE)], children: [] },
  { path: 'playlists', loadComponent: () => import('./features/playlists/playlists-page').then(m => m.PlaylistsPage), title: 'STATSHEETS - PLAYLISTS' },
  { path: 'bkscorner', loadComponent: () => import('./features/bkscorner/bk-corner-page').then(m => m.BkCornerPage), title: "STATSHEETS - BK'S CORNER" },
  { path: 'baddie', loadComponent: () => import('./features/baddie/baddie-page').then(m => m.BaddiePage), title: 'STATSHEETS - SPIN A BADDIE' },
  { path: 'admin', loadComponent: () => import('./features/admin/admin-page').then(m => m.AdminPage), title: 'STATSHEETS - ADMIN' },
  { path: '**', redirectTo: '' },
];
