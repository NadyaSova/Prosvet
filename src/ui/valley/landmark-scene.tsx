// Сооружение конечного босса в долине (docs/phase2-plan.md §5.2): само сооружение (landmark-art.tsx) и клочья
// тумана над ним. Туман — плотность из модели (sceneOf), сооружение проступает сквозь него по landmarkVisibility,
// как на экране босса. После победы тумана нет.
//
// Только что изменившееся (fresh): новый босс — сооружение под туманом появляется; подход — туман редеет;
// победа — туман рассеивается, сооружение проявляется целиком. При «уменьшить движение» — сразу конечный вид.

import type { SceneLandmark } from '../../logic/valley';
import { LANDMARK_MIST, landmarkVisibility } from '../boss-art';
import { PALETTE } from '../palette';
import { LANDMARK_BOX, LandmarkArt } from './landmark-art';

/** Id градиента тумана — один на картину долины (ValleyScene кладёт его в defs). */
export const LANDMARK_MIST_ID = 'landmark-mist';

export function LandmarkMistGradient() {
  return (
    <radialGradient id={LANDMARK_MIST_ID}>
      <stop offset="0" stop-color="#f3f1f3" stop-opacity="1" />
      <stop offset="0.55" stop-color="#e2e1e6" stop-opacity="0.9" />
      <stop offset="1" stop-color={PALETTE.mist} stop-opacity="0" />
    </radialGradient>
  );
}

export function ValleyLandmarkArt({ l, fresh }: { l: SceneLandmark; fresh: boolean }) {
  const show = l.won ? 1 : landmarkVisibility(l.fog);
  const showFrom = landmarkVisibility(l.fogBefore);
  const change = fresh && l.fogBefore !== l.fog;
  const appear = fresh && !l.won && l.sessions === 0;
  const fade = (from: number, to: number) => (change ? { '--from': from.toFixed(3), '--to': to.toFixed(3) } : undefined);
  return (
    <g
      transform={`translate(${l.x} ${l.y})`}
      class={appear ? 'decor--new' : undefined}
      role="img"
      aria-label={l.won ? undefined : 'Сооружение под туманом'}
    >
      {(show > 0.02 || change) && (
        <g class={change ? 'landmark__fade' : undefined} style={fade(showFrom, show)} opacity={show.toFixed(3)} aria-hidden={!l.won}>
          <LandmarkArt kind={l.kind} seed={l.seed} size={l.size} />
        </g>
      )}
      {(l.fog > 0 || change) && (
        <g
          class={change ? (l.won ? 'landmark__fade landmark__fade--lift' : 'landmark__fade') : undefined}
          style={fade(l.fogBefore, l.fog)}
          opacity={l.fog.toFixed(3)}
          aria-hidden="true"
        >
          <g transform={`scale(${(l.size / LANDMARK_BOX.height).toFixed(3)})`}>
            {LANDMARK_MIST.map((m, i) => (
              <ellipse key={i} {...m} fill={`url(#${LANDMARK_MIST_ID})`} />
            ))}
          </g>
        </g>
      )}
    </g>
  );
}
