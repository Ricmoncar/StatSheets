// JUKO! · THE CODE GARDEN, the page: the garden behind the sheet and the
// terminal over the window. One page for her base form and for 0∞ (the
// breakdown follows the form without a reload); "1" has a page of its own.
import { sceneModule } from '../kit/scene';
import { Garden } from './garden';
import { terminal } from './terminal';

export const { drawBackground, resetBackground, startOverlay, stopOverlay } = sceneModule(new Garden(), terminal);
