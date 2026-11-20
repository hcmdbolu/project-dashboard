import 'dotenv/config';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { startOverdueActionsCron } from './jobs/overdueActions';
import adminRouter from './routes/admin';
import budgetsRouter from './routes/budgets';
import departmentsRouter from './routes/departments';
import healthRouter from './routes/health';
import portfolioRouter from './routes/portfolio';

const app = express();
const port = Number(process.env.PORT || 4000);

app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'gsl-enterprise-portfolio-api',
    health: '/api/health',
  });
});

app.use('/api/health', healthRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/admin', adminRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/budgets', budgetsRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server error]', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`GSL Enterprise Portfolio API listening on 0.0.0.0:${port}`);
  startOverdueActionsCron();
});
