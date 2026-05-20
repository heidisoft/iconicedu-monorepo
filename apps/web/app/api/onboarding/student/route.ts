import { proxyPostToApi } from '@iconicedu/web/app/api/_lib/proxy-to-api';

export async function POST(request: Request) {
  return proxyPostToApi(request, '/onboarding/student');
}
