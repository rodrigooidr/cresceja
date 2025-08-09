exports.parseMessage = (req, res) => {
  const { message, channel_type } = req.body;

  let extracted = {};
  let tone = '';
  let next_prompt = '';

  if (/meu nome é/i.test(message)) {
    extracted.name = message.match(/meu nome é\s+([\w\s]+)/i)?.[1]?.trim();
  }

  if (/\(?\d{2}\)?\s?\d{4,5}-\d{4}/.test(message)) {
    const parts = message.match(/(\d{2})\)?\s?(\d{4,5}-\d{4})/);
    extracted.phone = `+55${parts[1]}${parts[2].replace('-', '')}`;
  }

  switch (channel_type) {
    case 'whatsapp':
      tone = '😄 Claro! Vamos agilizar isso!';
      next_prompt = 'Pode me passar o nome da sua empresa também?';
      break;
    case 'instagram':
      tone = '✨ Show! Adorei seu interesse.';
      next_prompt = 'Qual o nome da sua marca? 😉';
      break;
    case 'facebook':
      tone = 'Obrigado pelo contato.';
      next_prompt = 'Para continuarmos, poderia informar o nome da empresa?';
      break;
    default:
      tone = 'Vamos continuar.';
      next_prompt = 'Pode compartilhar mais detalhes?';
  }

  return res.json({
    extracted,
    tone,
    next_prompt
  });
};