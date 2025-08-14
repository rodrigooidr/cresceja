// controllers/approvalController.js

// Armazenamento em memória para demonstração
let approvals = [];

/**
 * POST /:postId/request
 * Cria uma nova solicitação de aprovação para um post.
 */
export function requestApproval(req, res) {
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

  return res.status(201).json({ message: 'Aprovação solicitada.' });
}

/**
 * POST /:postId/approve
 * Aprova o post.
 */
export function approvePost(req, res) {
  const { postId } = req.params;
  const { comment } = req.body;
  const user = req.user;

  const approval = approvals.find(a => a.post_id === postId);
  if (!approval) return res.status(404).json({ error: 'Solicitação não encontrada.' });

  approval.status = 'approved';
  approval.comment = comment || '';
  approval.approved_by = user?.id ?? null;
  approval.updated_at = new Date();

  return res.json({ message: 'Post aprovado com sucesso.' });
}

/**
 * POST /:postId/reject
 * Rejeita o post.
 */
export function rejectPost(req, res) {
  const { postId } = req.params;
  const { comment } = req.body;
  const user = req.user;

  const approval = approvals.find(a => a.post_id === postId);
  if (!approval) return res.status(404).json({ error: 'Solicitação não encontrada.' });

  approval.status = 'rejected';
  approval.comment = comment || 'Sem justificativa.';
  approval.approved_by = user?.id ?? null;
  approval.updated_at = new Date();

  return res.json({ message: 'Post rejeitado.' });
}

/**
 * GET /:postId
 * Retorna o histórico de aprovações do post.
 */
export function getApprovalHistory(req, res) {
  const { postId } = req.params;
  const history = approvals.filter(a => a.post_id === postId);
  return res.json(history);
}

// Aliases opcionais para compatibilidade
export const approveLevel = approvePost;
export const reject = rejectPost;
export const fetchApprovals = getApprovalHistory;

// Utilitário para testes
export function _resetApprovals() {
  approvals = [];
}
