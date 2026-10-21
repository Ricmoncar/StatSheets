// Default build settings: the SAFE ones.
//
// Every top-level Firestore collection name gets `collectionPrefix` in front
// of it. 'next_' points at the test copy of the database the /next/ preview
// uses, so nothing done in development or in the preview can touch the real
// characters. Only the cutover build (environment.live.ts, added when the new
// site replaces the old one) uses the real collections.
export const environment = {
  collectionPrefix: 'next_',
  /** Shown in the corner of every page while the app runs on the test copy. */
  sandboxLabel: 'PREVIEW: TEST DATA',
};
