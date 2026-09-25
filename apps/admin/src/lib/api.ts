import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DatabaseError, formatZodIssues } from '@tech-inject/database';
import { authenticateAdminRequest } from './auth';

export interface ApiErrorBody {
  error: string;
  /** Field-level validation issues, when the failure was a schema violation. */
  issues?: Array<{ path: string; message: string }>;
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number, issues?: ApiErrorBody['issues']): NextResponse {
  const body: ApiErrorBody = issues ? { error: message, issues } : { error: message };
  return NextResponse.json(body, { status });
}

export const unauthorized = (): NextResponse =>
  NextResponse.json({ error: 'Unauthorized' } satisfies ApiErrorBody, {
    status: 401,
    headers: { 'WWW-Authenticate': 'Admin realm="tech-inject"' }
  });

/**
 * Wraps a route handler with admin authentication and uniform error mapping, so
 * every write endpoint fails the same way and no handler can forget the check.
 */
export function withAdminAuth<TContext>(
  handler: (request: Request, context: TContext) => Promise<NextResponse>
): (request: Request, context: TContext) => Promise<NextResponse> {
  return async (request, context) => {
    let auth: ReturnType<typeof authenticateAdminRequest>;
    try {
      auth = authenticateAdminRequest(request);
    } catch (error) {
      // A misconfigured ADMIN_SECRET must fail closed, never open.
      console.error('Admin authentication misconfigured', error);
      return jsonError('Server misconfigured', 500);
    }

    if (!auth.ok) return unauthorized();

    try {
      return await handler(request, context);
    } catch (error) {
      return mapErrorToResponse(error);
    }
  };
}

/** Translates thrown errors into the API's error contract. */
export function mapErrorToResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return jsonError('Validation failed', 422, formatZodIssues(error));
  }
  if (error instanceof SyntaxError) {
    return jsonError(error.message.includes('JSON') ? error.message : 'Malformed request body', 400);
  }
  if (error instanceof DatabaseError) {
    console.error(error);
    // 23505 is Postgres' unique-violation code surfaced through PostgREST.
    if (error.code === '23505') return jsonError('A component with that slug already exists', 409);
    return jsonError('Database operation failed', 502);
  }

  console.error('Unhandled admin API error', error);
  return jsonError('Internal server error', 500);
}

/** Reads and JSON-parses a request body, raising `SyntaxError` on garbage. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.trim().length === 0) throw new SyntaxError('Request body is empty');
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new SyntaxError('Request body is not valid JSON');
  }
}
