import { environment } from '../../environments/environment';

/**
 * The old Spin a Baddie game, kept as it is rather than redesigned. Every
 * build serves it beside the app (the /next/ preview uses the old site's copy
 * one folder up), so its links to sounds/ and baddies/ still work.
 */
export const BADDIE_PAGE = environment.assetBase + 'baddie.html';
