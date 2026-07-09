import v from 'vkrun';

/**
 * Sends a JSON response with the given status code and data.
 * Eliminates boilerplate of manually setting Content-Type and calling JSON.stringify.
 */
export function sendJson(res: v.Response, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(JSON.stringify(data));
}
