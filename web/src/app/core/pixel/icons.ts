/**
 * 7x7 UI icons ('X' is a pixel). Each renders as an inline SVG path in
 * currentColor; the SOUL heart sits in the same box and takes the icon's
 * place when the control is hovered, focused or current (the menu rule).
 */
export const ICONS = {
  ast: '.......\n...X...\n.X.X.X.\n..XXX..\n.X.X.X.\n...X...\n.......',
  sign: '...X...\nXXXXXX.\nXXXXXXX\nXXXXXX.\n...X...\n..XXX..\n...X...',
  menu: '.......\nXXXXXXX\n.......\nXXXXXXX\n.......\nXXXXXXX\n.......',
  bolt: '....XX.\n...XX..\n..XX...\n.XXXXX.\n...XX..\n..XX...\n.XX....',
  speaker: '...X...\n..XX..X\nXXXX.X.\nXXXX.X.\nXXXX.X.\n..XX..X\n...X...',
  mute: '...X...\n..XX...\nXXXX.X.\nXXXX..X\nXXXX.X.\n..XX...\n...X...',
  plus: '...X...\n...X...\n...X...\nXXXXXXX\n...X...\n...X...\n...X...',
  minus: '.......\n.......\n.......\nXXXXXXX\n.......\n.......\n.......',
  search: '.XXX...\nX...X..\nX...X..\nX...X..\n.XXXX..\n....XX.\n.....XX',
  cmp: '...X...\nXXXXXXX\n.X...X.\nX.X.X.X\nXXX.XXX\n...X...\n.XXXXX.',
  pencil: '.....XX\n....X.X\n...X.X.\n..X.X..\n.X.X...\nXXX....\nXX.....',
  trash: '..XXX..\nXXXXXXX\n.X.X.X.\n.X.X.X.\n.X.X.X.\n.X.X.X.\n.XXXXX.',
  bars: '.....X.\n.....X.\n...X.X.\n...X.X.\n.X.X.X.\n.X.X.X.\nXXXXXXX',
  bag: '..XXX..\n.X...X.\nXXXXXXX\nX.....X\nX.XXX.X\nX.....X\nXXXXXXX',
  star: '...X...\n...X...\nXXXXXXX\n.XXXXX.\n..XXX..\n.XX.XX.\n.X...X.',
  book: '.XX.XX.\nX..X..X\nX..X..X\nX..X..X\nX..X..X\nXXXXXXX\n...X...',
  heart: '.XX.XX.\nXXXXXXX\nXXXXXXX\n.XXXXX.\n..XXX..\n...X...\n.......',
  note: '..XXXXX\n..X...X\n..X...X\n..X...X\nXXX.XXX\nXXX.XXX\n.......',
  chat: 'XXXXXXX\nX.....X\nX.X.X.X\nX.....X\nXXXXXXX\n.XX....\n.X.....',
  gear: '.X.X.X.\nXXXXXXX\n.XX.XX.\nXX...XX\n.XX.XX.\nXXXXXXX\n.X.X.X.',
  q: '.XXXXX.\nXX...XX\n....XX.\n...XX..\n...XX..\n.......\n...XX..',
  dice: 'XXXXXXX\nX.XXXXX\nXXXXXXX\nXXX.XXX\nXXXXXXX\nXXXXX.X\nXXXXXXX',
  play: '.X.....\n.XX....\n.XXX...\n.XXXX..\n.XXX...\n.XX....\n.X.....',
  pause: '.......\n.XX.XX.\n.XX.XX.\n.XX.XX.\n.XX.XX.\n.XX.XX.\n.......',
  prev: 'X....X.\nX...XX.\nX..XXX.\nX.XXXX.\nX..XXX.\nX...XX.\nX....X.',
  next: '.X....X\n.XX...X\n.XXX..X\n.XXXX.X\n.XXX..X\n.XX...X\n.X....X',
  shuf: '.....X.\nXX...XX\n..X.XX.\n...X...\n..X.XX.\nXX...XX\n.....X.',
  rep: '....X..\n.XXXXX.\nX...X..\nX.....X\n..X...X\n.XXXXX.\n..X....',
  grip: '.......\n..X.X..\n.......\n..X.X..\n.......\n..X.X..\n.......',
  check: '......X\n.....XX\nX...XX.\nXX.XX..\n.XXX...\n..X....\n.......',
  x: 'XX...XX\nXXX.XXX\n.XXXXX.\n..XXX..\n.XXXXX.\nXXX.XXX\nXX...XX',
  chev: '.......\n.......\nX.....X\nXX...XX\n.XX.XX.\n..XXX..\n...X...',
  right: '..X....\n..XX...\n...XX..\n....XX.\n...XX..\n..XX...\n..X....',
  left: '....X..\n...XX..\n..XX...\n.XX....\n..XX...\n...XX..\n....X..',
  lock: '..XXX..\n.X...X.\n.X...X.\nXXXXXXX\nXXX.XXX\nXXX.XXX\nXXXXXXX',
  folder: '.......\nXXX....\nX..XXXX\nX.....X\nX.....X\nXXXXXXX\n.......',
  coin: '..XXX..\n.X...X.\nX..X..X\nX.XXX.X\nX..X..X\n.X...X.\n..XXX..',
  camera: '..XX...\nXXXXXXX\nX..X..X\nX.X.X.X\nX..X..X\nXXXXXXX\n.......',
  tools: 'X.....X\nXX...XX\n.XX.XX.\n..XXX..\n.XX.XX.\nXX...XX\nX.....X',
  crown: '.......\nX..X..X\nXX.X.XX\nXXXXXXX\nXXXXXXX\nXXXXXXX\n.......',
  info: '...X...\n.......\n..XX...\n...X...\n...X...\n...X...\n..XXX..',
  upload: '...X...\n..XXX..\n.X.X.X.\n...X...\n...X...\n.......\nXXXXXXX',
  eye: '.......\n..XXX..\n.X...X.\nX..X..X\n.X...X.\n..XXX..\n.......',
} as const;

export type IconName = keyof typeof ICONS;

/** One SVG path per icon: runs of pixels on a row become one rectangle. */
export function iconPath(grid: string): string {
  let d = '';
  grid.split('\n').forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === 'X') { let e = x; while (row[e] === 'X') e++; d += `M${x} ${y}h${e - x}v1h${x - e}z`; x = e; }
      else x++;
    }
  });
  return d;
}

export const ICON_PATHS = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, iconPath(v)])) as Record<IconName, string>;
export const SOUL_PATH = ICON_PATHS.heart;
