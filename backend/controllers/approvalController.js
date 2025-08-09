let approvals = [];

exports.requestApproval = (req, res) => {
  const { postId } = req.params;
  approvals.push({
    id: `apr-${Date.now()}`,
    post_id: postId,
    status: 'pending',
    comment: null,
    level: 1,
    approved_by: null,
    created_at: new Date(),
    updated_at: new Date()
  });
  res.status(201).json({ message: 'Aprovação solicitada.' });
};

exports.approvePost = (req, res) => {
  const { postId } = req.params;
  const { comment } = req.body;
  const user = req.user;

  const approval = approvals.find(a => a.post_id === postId);
  if (!approval) return res.status(404).json({ error: 'Solicitação não encontrada.' });

  approval.status = 'approved';
  approval.comment = comment || '';
  approval.approved_by = user.id;
  approval.updated_at = new Date();

  res.json({ message: 'Post aprovado com sucesso.' });
};

exports.rejectPost = (req, res) => {
  const { postId } = req.params;
  const { comment } = req.body;
  const user = req.user;

  const approval = approvals.find(a => a.post_id === postId);
  if (!approval) return res.status(404).json({ error: 'Solicitação não encontrada.' });

  approval.status = 'rejected';
  approval.comment = comment || 'Sem justificativa.';
  approval.approved_by = user.id;
  approval.updated_at = new Date();

  res.json({ message: 'Post rejeitado.' });
};

exports.getApprovalHistory = (req, res) => {
  const { postId } = req.params;
  const history = approvals.filter(a => a.post_id === postId);
  res.json(history);
};