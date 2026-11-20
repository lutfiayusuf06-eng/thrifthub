export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await request.json() }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        ok: false,
        response: Response.json({ error: 'Format JSON tidak valid.' }, { status: 400 }),
      }
    }
    throw error
  }
}
