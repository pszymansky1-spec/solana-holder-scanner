import { type NextRequest } from 'next/server';
import { getTokenInfo } from '@/lib/tokens';

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get('mint');
  if (!mint) {
    return Response.json({ error: 'mint param required' }, { status: 400 });
  }

  try {
    const info = await getTokenInfo(mint);
    return Response.json(info);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}