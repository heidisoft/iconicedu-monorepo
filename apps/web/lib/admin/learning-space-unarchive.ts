import { setEntityStatus } from '@iconicedu/web/lib/admin/entity-status';

export async function unarchiveLearningSpace(learningSpaceId: string) {
  await setEntityStatus('learning_spaces', learningSpaceId, 'active');
}
