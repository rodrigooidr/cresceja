const aiLogs = [
  { id: '1', company_id: 'demo', user_id: 'u1', service: 'gpt4o', category: 'content', tokens_used: 200, cost: 0.5, created_at: '2025-08-07T10:00:00Z' },
  { id: '2', company_id: 'demo', user_id: 'u2', service: 'dalle3', category: 'content', tokens_used: 1, cost: 1.0, created_at: '2025-08-07T11:00:00Z' },
  { id: '3', company_id: 'demo', user_id: 'u1', service: 'gpt4o', category: 'chat', tokens_used: 150, cost: 0.3, created_at: '2025-08-07T12:00:00Z' }
];

const activityLogs = [
  { id: 'a1', company_id: 'demo', user_id: 'u1', action: 'create_post', resource_type: 'post', resource_id: 'p1', created_at: '2025-08-07T10:30:00Z' },
  { id: 'a2', company_id: 'demo', user_id: 'u1', action: 'generate_ia_text', resource_type: 'post', resource_id: 'p1', created_at: '2025-08-07T10:31:00Z' },
  { id: 'a3', company_id: 'demo', user_id: 'u2', action: 'approve_post', resource_type: 'post', resource_id: 'p1', created_at: '2025-08-07T11:00:00Z' }
];

exports.getIaUsage = (req, res) => {
  const user = req.user;
  const result = aiLogs.filter(log => log.company_id === user.company_id);
  res.json(result);
};

exports.getActivityLog = (req, res) => {
  const user = req.user;
  const result = activityLogs.filter(log => log.company_id === user.company_id);
  res.json(result);
};