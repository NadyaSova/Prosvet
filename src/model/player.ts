import type { PlayerState } from './types';

export function createPlayer(): PlayerState {
  return {
    xp: { chronicle: 0, image: 0, speech: 0, scouting: 0, hunt: 0 },
    gold: 0,
    stars: 0,
    streak: { startDay: null, lastActiveDay: null, extraDays: 0, logs: 0, milestoneReached: 0 },
    branchLastTouched: {},
    inventory: [],
  };
}
