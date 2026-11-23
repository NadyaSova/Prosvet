// Иконки разделов на главном экране: Летопись (книга с пером), Голубятня (домик на столбе с голубем),
// Лавка (прилавок под полосатым навесом). Рисунки отдельно от логики, как вся графика.

import { PALETTE } from './palette';

const INK = PALETTE.chronicle;
const PAPER = PALETTE.paper;

export function ChronicleIcon({ class: className }: { class?: string }) {
  return (
    <svg class={className} viewBox="0 0 64 64" aria-hidden="true">
      {/* обложка */}
      <path d="M5 24 L32 28 L59 24 L59 52 L32 56 L5 52 Z" fill={INK} />
      {/* страницы */}
      <path d="M8 20 Q20 17 32 24 L32 52 Q20 46 8 48 Z" fill={PAPER} stroke={INK} stroke-width="1.5" stroke-linejoin="round" />
      <path d="M56 20 Q44 17 32 24 L32 52 Q44 46 56 48 Z" fill={PAPER} stroke={INK} stroke-width="1.5" stroke-linejoin="round" />
      {/* строки */}
      <g stroke="#cbb48f" stroke-width="1.6" stroke-linecap="round" fill="none">
        <path d="M12 27 Q20 25.5 28 29" />
        <path d="M12 33 Q20 31.5 28 35" />
        <path d="M12 39 Q18 38 24 40" />
        <path d="M36 29 Q42 26.5 46 26.5" />
        <path d="M36 35 Q42 32.5 45 32.5" />
      </g>
      {/* перо */}
      <path d="M41 47 Q43 24 60 6 Q57 29 41 47 Z" fill="#f1e6d2" stroke={INK} stroke-width="1.4" stroke-linejoin="round" />
      <path d="M41 47 L58 9" stroke={INK} stroke-width="1.2" stroke-linecap="round" />
      <path d="M41 47 L38.5 52" stroke={PALETTE.ink} stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

export function LoftIcon({ class: className }: { class?: string }) {
  return (
    <svg class={className} viewBox="0 0 64 64" aria-hidden="true">
      {/* трава и столб */}
      <ellipse cx="32" cy="59" rx="14" ry="3" fill={PALETTE.hillMid} />
      <rect x="29.5" y="40" width="5" height="19" rx="1.5" fill={PALETTE.log} />
      {/* домик */}
      <rect x="15" y="25" width="34" height="18" rx="2" fill={PALETTE.canvas} stroke={PALETTE.log} stroke-width="1.5" />
      <path d="M10 27 L32 12 L54 27 Z" fill={PALETTE.hunt} stroke="#2f5541" stroke-width="1.5" stroke-linejoin="round" />
      {/* летки и жёрдочка */}
      <path d="M20 39 L20 33 A4 4 0 0 1 28 33 L28 39 Z" fill="#5a4636" />
      <path d="M36 39 L36 33 A4 4 0 0 1 44 33 L44 39 Z" fill="#5a4636" />
      <path d="M17 40.5 L47 40.5" stroke={PALETTE.log} stroke-width="2" stroke-linecap="round" />
      {/* голубь на крыше */}
      <path d="M30 13 L23 9 L27 14 Z" fill="#7d8aa0" />
      <ellipse cx="34" cy="11" rx="6.5" ry="4.2" fill="#9aa7b8" />
      <path d="M31 10 Q34 7.5 37.5 10" stroke="#7d8aa0" stroke-width="1.3" fill="none" stroke-linecap="round" />
      <circle cx="40" cy="6.5" r="3" fill="#9aa7b8" />
      <path d="M38.2 8.6 Q40 10 41.8 8.6" stroke="#8fb39a" stroke-width="1.2" fill="none" />
      <path d="M42.8 6.3 L45.2 7 L42.8 7.7 Z" fill="#e0a85a" />
      <circle cx="40.8" cy="5.8" r="0.7" fill={PALETTE.ink} />
    </svg>
  );
}

/** Навес лавки: полосы с фестонами, золото и сливки по очереди. */
const AWNING = [0, 1, 2, 3, 4, 5].map((i) => {
  const x = 8 + i * 8;
  return { d: `M${x} 15 L${x + 8} 15 L${x + 8} 25 Q${x + 4} 30.5 ${x} 25 Z`, fill: i % 2 === 0 ? PALETTE.gold : PAPER };
});

export function ShopIcon({ class: className }: { class?: string }) {
  return (
    <svg class={className} viewBox="0 0 64 64" aria-hidden="true">
      {/* столбы */}
      <rect x="10" y="22" width="4" height="36" rx="1.5" fill={PALETTE.log} />
      <rect x="50" y="22" width="4" height="36" rx="1.5" fill={PALETTE.log} />
      {/* навес */}
      <rect x="6" y="10" width="52" height="6" rx="2" fill={PALETTE.goldDeep} />
      {AWNING.map((s, i) => (
        <path key={i} d={s.d} fill={s.fill} stroke={PALETTE.goldDeep} stroke-width="1.2" stroke-linejoin="round" />
      ))}
      {/* товар на прилавке: саженец в горшке, яблоко, золото */}
      <path d="M17 38 L25 38 L24 44 L18 44 Z" fill="#c0674a" />
      <path d="M21 38 L21 32" stroke={PALETTE.leafDark} stroke-width="1.5" stroke-linecap="round" />
      <ellipse cx="18.5" cy="32" rx="3" ry="1.8" fill={PALETTE.leafLight} transform="rotate(-25 18.5 32)" />
      <ellipse cx="23.5" cy="31" rx="3" ry="1.8" fill={PALETTE.leaf} transform="rotate(25 23.5 31)" />
      <circle cx="33" cy="40.5" r="3.8" fill={PALETTE.apple} />
      <circle cx="31.8" cy="39.2" r="1.1" fill="#fff" opacity="0.6" />
      <path d="M33 36.8 L34 34.5" stroke={PALETTE.bark} stroke-width="1.2" stroke-linecap="round" />
      <ellipse cx="43" cy="43" rx="5" ry="1.8" fill={PALETTE.goldDeep} />
      <ellipse cx="43" cy="41" rx="5" ry="1.8" fill={PALETTE.gold} stroke={PALETTE.goldDeep} stroke-width="0.8" />
      <ellipse cx="43" cy="38.6" rx="5" ry="1.8" fill="#e9bd5c" stroke={PALETTE.goldDeep} stroke-width="0.8" />
      {/* прилавок */}
      <rect x="8" y="44" width="48" height="10" rx="2" fill="#b98a5a" stroke={PALETTE.log} stroke-width="1.5" />
      <path d="M8 49 L56 49" stroke={PALETTE.log} stroke-width="1" opacity="0.6" />
    </svg>
  );
}
