import { useState } from 'react';
import ConversationList from '../../components/Inbox/ConversationList.jsx';
import ChatWindow from '../../components/Inbox/ChatWindow.jsx';
import MessageComposer from '../../components/Inbox/MessageComposer.jsx';
import RightPanel from '../../components/Inbox/RightPanel.jsx';
import { useRealtimeInbox } from '../../hooks/useRealtimeInbox.js';

export default function InboxPage() {
  const [selected, setSelected] = useState(null);

  useRealtimeInbox({ conversationId: selected?.id });

  return (
    <div className="h-full flex">
      <div className="w-64 resize-x overflow-auto border-r">
        <ConversationList onSelect={setSelected} selectedId={selected?.id} />
      </div>
      <div className="flex-1 flex flex-col">
        {selected ? (
          <ChatWindow conversation={selected} />
        ) : (
          <div className="p-4">Selecione uma conversa</div>
        )}
        {selected && <MessageComposer conversation={selected} />}
      </div>
      <div className="w-64 resize-x overflow-auto border-l">
        {selected && <RightPanel conversation={selected} />}
      </div>
    </div>
  );
}
