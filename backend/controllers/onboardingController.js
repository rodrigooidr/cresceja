// ESM — exports nomeados + default opcional para compatibilidade

export const getProgress = (req, res) => {
  res.json({
    completed_steps: 2,
    total_steps: 5,
    steps: ['Conta criada', 'WhatsApp conectado'],
  });
};

export const check = (req, res) => {
  res.json({ ok: true });
};

// Export default opcional: permite importar como "import controller from ..."
export default { getProgress, check };
