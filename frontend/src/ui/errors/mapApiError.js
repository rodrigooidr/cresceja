export function mapApiErrorToForm(err, setError) {
  const code = err?.response?.data?.error;
  if (code === 'exclusive_mode') return { toast: 'Conflito: Baileys e API são exclusivos para o mesmo número.' };
  if (code === 'feature_disabled') return { toast: 'Seu plano não permite este recurso.' };
  if (code === 'feature_limit_reached') return { toast: 'Limite do plano atingido.' };
  if (code === 'ig_quota_reached') return { toast: 'Limite diário do Instagram atingido.' };
  if (code === 'reauth_required') return { toast: 'Reautorização necessária.' };
  if (code === 'duplicate_job') return { toast: 'Publicação duplicada.' };
  if (code === 'job_not_pending') return { toast: 'Job não está pendente.' };
  if (code === 'validation') { setError(err?.response?.data?.field || 'field', { message: 'Valor inválido.' }); return {}; }
  if (code === 'duplicate_email') { setError('email', { message: 'E-mail já cadastrado nesta organização.' }); return {}; }
  // etc.
  return { toast: 'Não foi possível concluir a operação.' };
}
