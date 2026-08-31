import type { CompanionState } from '../companions/types';

export type RelationshipStage = 'new' | 'familiar' | 'trusted' | 'close';

export function getRelationshipStage(state: CompanionState): RelationshipStage {
  if (state.affinity >= 70 && state.trust >= 50) return 'close';
  if (state.affinity >= 35 && state.trust >= 20) return 'trusted';
  if (state.affinity >= 10) return 'familiar';
  return 'new';
}

export function relationshipStageLabel(stage: RelationshipStage) {
  return ({ new: '初识', familiar: '熟悉', trusted: '信任', close: '亲近伙伴' })[stage];
}
