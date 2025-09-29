import express from 'express';
import adminOrgsRouter from './routes/admin/orgs.js';
import adminOrgByIdRouter from './routes/admin/orgById.js';
import adminPlansRouter from './routes/admin/plans.js';
import { withOrgId } from './middleware/withOrgId.js';

const app = express();
app.use(express.json());
app.use('/api/admin/plans', adminPlansRouter);
app.use('/api/admin/orgs', adminOrgsRouter);
app.use('/api/admin/orgs/:orgId', withOrgId, adminOrgByIdRouter);

export default app;
