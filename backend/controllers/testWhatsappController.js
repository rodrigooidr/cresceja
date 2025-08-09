const { getOrCreateChannelForOwner } = require('../services/channelService');

let conversations = [];
let messages = [];

exports.receiveMessage = (req, res) => {
  const { from, body } = req.body;
  const user = req.user;
  const companyId = user.company_id;

  const channelId = getOrCreateChannelForOwner(companyId);

  let conversation = conversations.find(
    (c) => c.customer_phone === from && c.channel_id === channelId
  );

  if (!conversation) {
    conversation = {
      id: `conv-${Date.now()}`,
      channel_id: channelId,
      company_id: companyId,
      customer_name: from,
      customer_phone: from,
      status: 'open',
      priority: 'normal'
    };
    conversations.push(conversation);
  }

  messages.push({
    id: `msg-${Date.now()}`,
    conversation_id: conversation.id,
    content: body,
    sender_type: 'customer',
    source_type: 'manual_test',
    created_at: new Date()
  });

  res.json({ success: true });
};