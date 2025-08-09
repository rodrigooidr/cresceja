let onboarding = [];

exports.checkStep = (req, res) => {
  const { step } = req.body;
  const user = req.user;

  onboarding.push({
    id: `step-${Date.now()}`,
    company_id: user.company_id,
    user_id: user.id,
    step,
    completed_at: new Date()
  });

  res.status(201).json({ message: 'Etapa marcada como concluída.' });
};

exports.getProgress = (req, res) => {
  const user = req.user;
  const steps = onboarding.filter(o => o.company_id === user.company_id);
  res.json(steps);
};