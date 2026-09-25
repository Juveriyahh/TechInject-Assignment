import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DatabaseError } from '@tech-inject/database';
import type { ApiError } from '@tech-inject/shared';

/** Uniform JSON responses for the public catalogue API. */
export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number, code?: ApiError['code']): NextResponse {
  const body: ApiError = code ? { error: message, code } : { error: message };
  return NextResponse.json(body, { status });
}

/** Maps thrown errors onto the public error contract, leaking no internals. */
export function mapErrorToResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'BAD_REQUEST',
        issues: error.issues.map((issue) => ({ path: issue.path.join('.') || '(root)', message: issue.message }))
      } satisfies ApiError,
      { status: 400 }
    );
  }
  if (error instanceof SyntaxError) return jsonError('Request body is not valid JSON', 400, 'BAD_REQUEST');
  if (error instanceof DatabaseError) {
    console.error(error);
    return jsonError('Service temporarily unavailable', 502, 'SERVER_ERROR');
  }

  console.error('Unhandled catalogue API error', error);
  return jsonError('Internal server error', 500, 'SERVER_ERROR');
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.trim().length === 0) throw new SyntaxError('Request body is empty');
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new SyntaxError('Request body is not valid JSON');
  }
}
