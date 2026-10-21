// The /next/ preview on GitHub Pages (https://ricmoncar.github.io/StatSheets/next/).
// Test copy of the database; sounds and images come from the old site's
// folders one level up, so the preview does not duplicate them.
export const environment = {
  collectionPrefix: 'next_',
  sandboxLabel: 'PREVIEW: TEST DATA',
  assetBase: '../',
  firestoreEmulator: null as string | null,
  /**
   * Addresses as /StatSheets/next/#/c/<id>: GitHub Pages has no fallback to
   * index.html inside a folder, so a reloaded /next/c/<id> would be a 404.
   */
  hashRouting: true,
};
