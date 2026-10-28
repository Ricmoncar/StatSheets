// BIZZY'S HIVE: the page. The hive is drawn behind the sheet, the swarm over
// the window; the sheet's honeycomb is a tile drawn here and handed to the
// chrome (_chrome.scss) as --bizzy-comb.
import { rasterImage, sceneModule } from '../kit/scene';
import { Hive } from './hive';
import { P, combTile } from './look';
import { Swarm } from './swarm';

export const { drawBackground, resetBackground, startOverlay, stopOverlay } = sceneModule(new Hive(), new Swarm());

document.documentElement.style.setProperty('--bizzy-comb', rasterImage(combTile(), P.table));
