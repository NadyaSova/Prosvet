import type { PlayerState } from './types';

export function createPlayer(): PlayerState {
  return {
    xp: { chronicle: 0, scouting: 0, hunt: 0, call: 0, threads: 0, prep: 0, craft: 0 },
    gold: 0,
    stars: 0,
    streak: { startDay: null, lastActiveDay: null, extraDays: 0, logs: 0, milestoneReached: 0 },
    branchLastTouched: {},
    inventory: [],
  };
}
