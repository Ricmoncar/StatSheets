import { environment } from '../../environments/environment';

// Old pages kept as they are rather than redesigned. Every build serves them
// beside the app (web/shared-assets/pages links to the files at the repo root;
// the /next/ preview uses the old site's own copies one folder up), so their
// links to sounds/, baddies/, style.css and their scripts still work.
/** The Encyclopaedia (it loads encyclopedia.js, traits.js and style.css). */
export const ENCYCLOPEDIA_PAGE = environment.assetBase + 'encyclopedia.html';

/** A route guard that leaves the app for an old page (for its old address, /baddie and so on). */
export function toOldPage(page: string): () => false {
  return () => {
    location.assign(new URL(page, document.baseURI).href);
    return false;
  };
}
