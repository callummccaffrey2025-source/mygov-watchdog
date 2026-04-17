import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.number().min(1).max(50).optional()
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  
  const validation = searchSchema.safeParse({
    q: query,
    limit: parseInt(searchParams.get('limit') || '10')
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: validation.error },
      { status: 400 }
    );
  }

  // TODO: Implement actual search against Supabase bills table
  return NextResponse.json(
    { results: [], query: validation.data.q },
    { 
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    }
  );
}
