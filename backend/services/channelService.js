import { v4 as uuidv4 } from 'uuid'

let channels = [];

function getOrCreateChannelForOwner(companyId) {
  let channel = channels.find(
    (c) => c.type === 'whatsapp_web' && c.company_id === companyId
  );

  if (!channel) {
    channel = {
      id: uuidv4(),
      name: 'WhatsApp Pessoal Web',
      type: 'whatsapp_web',
      company_id: companyId,
      is_active: true
    };
    channels.push(channel);
  }

  return channel.id;
}

export default { getOrCreateChannelForOwner };