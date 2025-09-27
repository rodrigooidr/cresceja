import express from 'express';
import adminOrgsRouter from './routes/admin/orgs.js';
import adminPlansRouter from './routes/admin/plans.js';

const app = express();
app.use(express.json());
app.use('/api/admin/plans', adminPlansRouter);
app.use('/api/admin', adminOrgsRouter);

export default app;
