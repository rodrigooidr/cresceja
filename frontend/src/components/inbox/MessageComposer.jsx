import { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';
import EmojiPicker from './EmojiPicker.jsx';

export default function MessageComposer({ conversation }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    inboxApi.get('/inbox/templates').then((r) => setTemplates(r.data.data || [])).catch(() => {});
  }, []);

  const send = async () => {
    await inboxApi.post(`/inbox/conversations/${conversation.id}/messages`, {
      text,
      template_id: templateId || undefined,
      attachments,
    });
    setText('');
    setTemplateId('');
    setAttachments([]);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    const uploaded = [];
    for (const f of files) {
      const form = new FormData();
      form.append('file', f);
      const res = await inboxApi.post('/inbox/uploads', form);
      uploaded.push({
        asset_id: res.data.asset_id,
        kind: f.type.startsWith('image/') ? 'image' : 'file',
        name: f.name,
        size_bytes: f.size,
      });
    }
    setAttachments((a) => [...a, ...uploaded]);
  };

  return (
    <div className="p-2 border-t">
      {showEmoji && <EmojiPicker onSelect={(e) => setText((t) => t + e)} />}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setShowEmoji((v) => !v)} className="px-2">😊</button>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="">Template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input type="file" multiple onChange={handleFiles} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        className="w-full border rounded p-2"
        rows={2}
        placeholder="Digite..."
      />
      <button onClick={send} className="mt-2 px-4 py-1 bg-blue-500 text-white rounded">
        Enviar
      </button>
    </div>
  );
}
