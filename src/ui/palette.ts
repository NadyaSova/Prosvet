// Общие цвета рисунков, нарисованных кодом (SVG). Пункт 2.8 в docs/design-system.md.
// Здесь — цвета, которые встречаются в нескольких рисунках, и цвета эскиза, совпадающие с переменными
// в :root файла src/styles.css. Значения должны совпадать с CSS: рисунки задают цвет числом.
// Оттенки, нужные одному рисунку (листва разных пород, оперение голубей), остаются в своих файлах.
// Старые рисунки в src/dev (галерея «было — стало») цвета не берут отсюда: они должны остаться прежними.

export const PALETTE = {
  // Цвета эскиза — те же, что в src/styles.css.
  sun: '#f6c177', // --color-sun
  fire: '#e8833a', // --color-fire
  log: '#8a5a3b', // --color-log
  hillFar: '#bcd1b3', // --color-hill-far
  hillMid: '#94b98f', // --color-hill-mid
  hillNear: '#5a8758', // --color-hill-near
  river: '#9cc9db', // --color-river
  mist: '#b9b9be', // --color-mist
  gold: '#d9a441', // --color-gold
  paper: '#fffaf2', // --color-card-strong
  ink: '#3f3a34', // --color-text
  chronicle: '#8c6a3f', // --branch-chronicle
  hunt: '#3f6e55', // --branch-hunt

  // Дерево: стволы, шесты, поленья, ткань палатки.
  bark: '#6b4a35',
  barkDark: '#5a3d2b',
  canvas: '#d9b98a',

  // Листва, плоды, тень на траве.
  leaf: '#5f9450',
  leafDark: '#4f8344',
  leafLight: '#6ea25b',
  apple: '#d8403a',
  shadowGreen: '#3f6b4a',

  // Свет и лепестки.
  glow: '#fff3b0',
  petalPink: '#f2a7b5',
  petalLilac: '#c9a0dc',

  // Яркое и тёмное золото: воротник плаща, золотое перо, вывеска лавки.
  goldBright: '#e2b04a',
  goldDeep: '#a87a22',
} as const;
