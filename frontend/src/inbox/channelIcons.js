// src/inbox/channelIcons.js

// Mapa de slug do canal -> identificador do ícone
// (mantém as chaves esperadas pelo teste)
const channelIconBySlug = {
  whatsapp: 'lucide:whatsapp',
  instagram: 'lucide:instagram',
  messenger: 'lucide:facebook',
  facebook: 'lucide:facebook',  // opcional: cobre ambos
  web: 'lucide:globe',
  sms: 'lucide:message-square',
  default: 'lucide:message-circle',
};

export default channelIconBySlug;
export { channelIconBySlug };
