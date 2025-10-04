import React, { useEffect, useState } from 'react';
import { authFetch } from '../services/session.js';

function AiCreditsPanel() {
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    authFetch('/api/ai-credits/status')
      .then(res => res.json())
      .then(data => setCredits(data));
  }, []);

  const renderBar = (used, limit) => {
    const percent = Math.min((used / limit) * 100, 100);
    const color =
      percent < 80 ? 'bg-green-500' : percent < 100 ? 'bg-yellow-500' : 'bg-red-600';

    return (
      <div className="w-full bg-gray-200 h-4 rounded">
        <div className={\`\${color} h-4 rounded\`} style={{ width: \`\${percent}%\` }}></div>
      </div>
    );
  };

  if (!credits) return <p>Carregando créditos de IA...</p>;

  return (
    <div className="bg-white p-4 border rounded space-y-4">
      <h3 className="text-lg font-bold">📊 Uso de Créditos de IA</h3>

      <div>
        <h4 className="font-semibold">Atendimento IA (WhatsApp, Instagram, etc)</h4>
        <p>{credits.chat.used} / {credits.chat.limit} mensagens</p>
        {renderBar(credits.chat.used, credits.chat.limit)}
      </div>

      <div>
        <h4 className="font-semibold mt-4">Criação de Conteúdo (posts, e-mails)</h4>
        <p>Textos: {credits.content.text.used} / {credits.content.text.limit}</p>
        {renderBar(credits.content.text.used, credits.content.text.limit)}

        <p className="mt-2">Imagens: {credits.content.image.used} / {credits.content.image.limit}</p>
        {renderBar(credits.content.image.used, credits.content.image.limit)}
      </div>
    </div>
  );
}

export default AiCreditsPanel;