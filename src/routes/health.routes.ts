import v from 'vkrun';

export const healthRouter = v.Router();

healthRouter.get('/', (req: v.Request, res: v.Response) => {
  res.status(200).send('Hello World!');
});

healthRouter.get('/health', (req: v.Request, res: v.Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({ status: 'ok' }));
});
