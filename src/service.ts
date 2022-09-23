import express from 'express';
import bodyParser from 'body-parser';
import Contracts from './controllers/Contracts.js';
import Plans from './controllers/Plans.js';
import { Utils, Types } from '@ikomida/shared-backend';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let { name } = require('../package.json');
name = name
  .replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
  .replace(/^\w/, (m: string) => m.toUpperCase())
  .replace(/-\w/g, (m: string) => m[1].toUpperCase());
const logger = Utils.Logger.getInstance(name);

const app = express();
app.disable('x-powered-by');
app.use(bodyParser.json({ limit: '10mb' }));
Utils.System.setExpressResponse(app);
const port = process?.env?.PORT || 80;
let contracts: Contracts;
let plans: Plans;

app.post('/contract/requestPhoneValidation', async (req, res) => {
  const payload = await contracts?.createPhoneValidation(req.body);
  res.status(payload?.success ? 201 : 400);
  res.sendResponse(payload);
});

app.post('/contract/validatePhoneValidationCode', async (req, res) => {
  const payload = await contracts?.validatePhoneValidationCode(req.body);
  res.status(payload?.success ? 200 : 400);
  res.sendResponse(payload);
});

app.post('/contract', async (req, res) => {
  const response = await contracts?.newContact(req.body, req?.ip);
  res.sendResponse(response);
});

app.get('/plans', async (req, res) => {
  const response = await plans?.getPlans();
  res.sendResponse(response);
});

app.all('*', async (req, res) => {
  logger.error(`Contracts endpoint "${req?.url}" not found:`);
  res.status(404);
  res.sendResponse({ error: 'NOT FOUND' });
});

try {
  contracts = new Contracts(logger);
  plans = new Plans(logger);

  app.listen(port, () => {
    logger.info(`${name} listening at http://localhost:${port}`);
  });
} catch (exception: any) {
  const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_CREATE_LISTNING_EXCEPTION, exception);
  error.log(logger);
}
