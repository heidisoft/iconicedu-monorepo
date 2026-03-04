import { setEntityStatus } from '@iconicedu/web/lib/admin/entity-status';

export async function archiveLearningSpace(learningSpaceId: string) {
  await setEntityStatus('learning_spaces', learningSpaceId, 'archived');
}
