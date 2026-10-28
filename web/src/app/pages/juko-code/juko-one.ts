// JUKO · 1, the value that was left, the page: the void behind the sheet and
// the sword over the window.
import { sceneModule } from '../kit/scene';
import { blade } from './blade';
import { Void } from './void';

const world = new Void();
export const { drawBackground, resetBackground, startOverlay, stopOverlay } = sceneModule(world, blade(world));
