import v from 'vkrun';
import { sendJson } from '../utils/response';

export const healthRouter = v.Router();

healthRouter.get('/', (_req: v.Request, res: v.Response) => {
  res.status(200).send('Hello World!');
});

healthRouter.get('/health', (_req: v.Request, res: v.Response) => {
  sendJson(res, 200, { status: 'ok' });
});
