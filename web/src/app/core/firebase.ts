import { InjectionToken } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBRtoLzS--wz_6sD4rWMgzcwZnHVHUBNdg',
  authDomain: 'statsheets-3668d.firebaseapp.com',
  projectId: 'statsheets-3668d',
  storageBucket: 'statsheets-3668d.firebasestorage.app',
  messagingSenderId: '558910483943',
  appId: '1:558910483943:web:c468342f15569a4cf0e142',
};

// The old site runs on the same origin (ricmoncar.github.io) with an older
// Firebase SDK and the default app name. Firestore names its offline cache in
// IndexedDB after the app, so a different app name gives this site its own
// cache instead of sharing (and possibly upgrading) the old site's.
const APP_NAME = 'statsheets-v2';

function app(): FirebaseApp {
  return getApps().some(a => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(FIREBASE_CONFIG, APP_NAME);
}

export function createFirestore(): Firestore {
  // Offline persistence shared between tabs, as on the old site: writes hit
  // the local cache at once, so the UI reflects them before the server confirms.
  return initializeFirestore(app(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

export const FIRESTORE = new InjectionToken<Firestore>('Firestore', {
  providedIn: 'root',
  factory: createFirestore,
});

/** The real name of a top-level collection for this build (see environment.ts). */
export function col(name: string): string {
  return environment.collectionPrefix + name;
}
