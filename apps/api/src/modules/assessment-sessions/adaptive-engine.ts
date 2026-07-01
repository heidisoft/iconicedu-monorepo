import type {
  AdaptiveConfig,
  AdaptiveState,
  SkillAdaptiveState,
} from '@iconicedu/shared-types';
import type { AssessmentItemVM } from '@iconicedu/shared-types';
import type { AssessmentItemsService } from '@iconicedu/api/modules/assessment-items/assessment-items.service';

export type AdaptiveEngineResult = {
  nextItem: AssessmentItemVM | null;
  isComplete: boolean;
  updatedState: AdaptiveState;
  note: string | null;
};

export async function runAdaptiveEngine(
  state: AdaptiveState,
  config: AdaptiveConfig,
  lastItemId: string,
  wasCorrect: boolean,
  itemsService: AssessmentItemsService,
  skillPrerequisites: Record<string, string[]>, // skillId → prerequisiteSkillIds
): Promise<AdaptiveEngineResult> {
  const updatedState = JSON.parse(JSON.stringify(state)) as AdaptiveState;
  let note: string | null = null;

  // Update state for the skill that just had a response
  const skillState = findSkillStateForItem(updatedState, lastItemId);
  if (skillState) {
    if (wasCorrect) {
      skillState.consecutiveCorrect++;
      skillState.consecutiveWrong = 0;
      skillState.totalCorrect++;
    } else {
      skillState.consecutiveWrong++;
      skillState.consecutiveCorrect = 0;
    }
    skillState.totalAttempted++;

    // Check advance rule
    if (skillState.consecutiveCorrect >= config.advanceTriggerCorrectCount) {
      const newDifficulty = Math.min(
        5,
        skillState.currentDifficulty + config.advanceDifficultyStep,
      );
      if (newDifficulty !== skillState.currentDifficulty) {
        skillState.currentDifficulty = newDifficulty;
        skillState.consecutiveCorrect = 0;
      }
    }

    // Check prerequisite trigger
    const missesInSkill = skillState.totalAttempted - skillState.totalCorrect;
    if (
      missesInSkill >= config.prereqTriggerMissCount &&
      skillState.prereqSkillsTriggered.length === 0
    ) {
      const prereqs = skillPrerequisites[skillState.skillId] ?? [];
      if (prereqs.length > 0) {
        for (let i = 0; i < Math.min(config.prereqItemsToInject, prereqs.length); i++) {
          const prereqSkillId = prereqs[i];
          if (!updatedState.prerequisiteQueue.some((q) => q.skillId === prereqSkillId)) {
            updatedState.prerequisiteQueue.push({
              skillId: prereqSkillId,
              difficulty: Math.max(1, skillState.currentDifficulty - 1),
              reason: `Prerequisite gap detected for skill ${skillState.skillId}`,
            });
            skillState.prereqSkillsTriggered.push(prereqSkillId);
          }
        }
        note = `Detected a gap — giving you prerequisite practice questions first.`;
      }
    }

    // Check stopping rules
    if (
      skillState.consecutiveCorrect >= config.stopOnConsecutiveCorrect ||
      skillState.consecutiveWrong >= config.stopOnConsecutiveWrong ||
      skillState.itemsServed.length >= config.maxItemsPerSkill
    ) {
      if (skillState.itemsServed.length >= config.minItemsPerSkill) {
        skillState.status = 'resolved';
        skillState.masteryEstimate =
          (skillState.totalCorrect / skillState.totalAttempted) * 100;
        if (!updatedState.completedSkillIds.includes(skillState.skillId)) {
          updatedState.completedSkillIds.push(skillState.skillId);
        }
      }
    }
  }

  // Pick next item
  const nextItem = await selectNextItem(updatedState, config, itemsService);
  const isComplete = nextItem === null;

  return { nextItem, isComplete, updatedState, note };
}

async function selectNextItem(
  state: AdaptiveState,
  config: AdaptiveConfig,
  itemsService: AssessmentItemsService,
): Promise<AssessmentItemVM | null> {
  // Priority 1: prerequisite queue
  while (state.prerequisiteQueue.length > 0) {
    const queued = state.prerequisiteQueue[0];
    const skillState = ensureSkillState(state, queued.skillId, queued.difficulty);

    if (skillState.status === 'resolved') {
      state.prerequisiteQueue.shift();
      continue;
    }

    const item = await itemsService.pickItemForSkillAndDifficulty(
      queued.skillId,
      queued.difficulty,
      skillState.itemsServed,
    );

    if (!item) {
      // No items available for this difficulty; try easier
      if (queued.difficulty > 1) {
        queued.difficulty = queued.difficulty - 1;
        continue;
      }
      state.prerequisiteQueue.shift();
      skillState.status = 'resolved';
      continue;
    }

    skillState.itemsServed.push(item.id);
    skillState.status = 'active';
    state.activeSkillId = queued.skillId;

    if (skillState.itemsServed.length >= config.prereqItemsToInject) {
      skillState.status = 'resolved';
      state.prerequisiteQueue.shift();
    }
    return item;
  }

  // Priority 2: continue active skill
  if (state.activeSkillId) {
    const active = state.skills[state.activeSkillId];
    if (active && active.status === 'active') {
      const item = await itemsService.pickItemForSkillAndDifficulty(
        state.activeSkillId,
        active.currentDifficulty,
        active.itemsServed,
      );
      if (item) {
        active.itemsServed.push(item.id);
        return item;
      }
      // No more items at this difficulty — resolve and move on
      active.status = 'resolved';
      state.completedSkillIds.push(state.activeSkillId);
    }
    state.activeSkillId = null;
  }

  // Priority 3: next pending skill in pool order
  const pendingSkillId = Object.keys(state.skills).find(
    (sid) => state.skills[sid].status === 'pending',
  );
  if (!pendingSkillId) return null; // All resolved

  const pendingState = state.skills[pendingSkillId];
  pendingState.status = 'active';
  state.activeSkillId = pendingSkillId;

  const item = await itemsService.pickItemForSkillAndDifficulty(
    pendingSkillId,
    pendingState.currentDifficulty,
    pendingState.itemsServed,
  );

  if (!item) {
    pendingState.status = 'resolved';
    state.activeSkillId = null;
    return selectNextItem(state, config, itemsService);
  }

  pendingState.itemsServed.push(item.id);
  return item;
}

function findSkillStateForItem(
  state: AdaptiveState,
  _itemId: string,
): SkillAdaptiveState | null {
  if (!state.activeSkillId) return null;
  return state.skills[state.activeSkillId] ?? null;
}

function ensureSkillState(
  state: AdaptiveState,
  skillId: string,
  startDifficulty: number,
): SkillAdaptiveState {
  if (!state.skills[skillId]) {
    state.skills[skillId] = {
      skillId,
      status: 'pending',
      currentDifficulty: startDifficulty,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      totalCorrect: 0,
      totalAttempted: 0,
      itemsServed: [],
      prereqSkillsTriggered: [],
      masteryEstimate: 0,
    };
  }
  return state.skills[skillId];
}

export function buildInitialAdaptiveState(
  skillPools: { skillId: string; startDifficulty: number }[],
): AdaptiveState {
  const skills: Record<string, SkillAdaptiveState> = {};
  for (const pool of skillPools) {
    skills[pool.skillId] = {
      skillId: pool.skillId,
      status: 'pending',
      currentDifficulty: pool.startDifficulty,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      totalCorrect: 0,
      totalAttempted: 0,
      itemsServed: [],
      prereqSkillsTriggered: [],
      masteryEstimate: 0,
    };
  }
  return { skills, activeSkillId: null, prerequisiteQueue: [], completedSkillIds: [] };
}
