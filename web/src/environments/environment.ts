// Default build settings: the SAFE ones, used by `ng serve`, tests and dev builds.
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
  /**
   * Where sounds/ and baddies/ are served from, relative to the app. Dev and
   * live builds copy them into the build; the /next/ preview reuses the copies
   * the old site already serves one folder up.
   */
  assetBase: '',
};
