// The end-to-end test build (`ng build -c e2e`): the test collections, but in
// a local Firestore emulator (rebuild/tools/seed_emulator.js loads it), so test
// runs never use the real project's daily quota, which the live site needs.
export const environment = {
  collectionPrefix: 'next_',
  sandboxLabel: 'TEST: LOCAL EMULATOR',
  assetBase: '',
  firestoreEmulator: '127.0.0.1:8085' as string | null,
};
