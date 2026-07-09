import v from 'vkrun';
import { sendJson } from '../utils/response';

export const healthRouter = v.Router();

const publicLimiter = v.rateLimit({
  windowMs: 60000,
  limit: 5,
});

healthRouter.get('/', publicLimiter, (_req: v.Request, res: v.Response) => {
  res.status(200).send('Hello World!');
});

healthRouter.get('/health', publicLimiter, (_req: v.Request, res: v.Response) => {
  sendJson(res, 200, { status: 'ok' });
});
