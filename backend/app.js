import express from 'express';
import adminOrgsRouter from './routes/admin/orgs.js';

const app = express();
app.use(express.json());
app.use('/api/admin', adminOrgsRouter);

export default app;
