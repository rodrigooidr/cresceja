import React, { useState } from 'react';

function ModalRepurpose({ postId, onClose }) {
  const [type, setType] = useState('story');
  const [tone, setTone] = useState('descontraído');
  const [output, setOutput] = useState(null);

  const handleRepurpose = async () => {
    const res = await fetch(`/api/posts/${postId}/repurpose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-jwt-token'
      },
      body: JSON.stringify({ type, tone })
    });
    const result = await res.json();
    setOutput(result);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold">🔁 Repurpose de Conteúdo</h2>
        <select className="border p-2 w-full" value={type} onChange={e => setType(e.target.value)}>
          <option value="story">Story</option>
          <option value="video">Vídeo curto</option>
          <option value="email">E-mail</option>
          <option value="alt_caption">Nova legenda</option>
        </select>
        <select className="border p-2 w-full" value={tone} onChange={e => setTone(e.target.value)}>
          <option value="descontraído">Descontraído</option>
          <option value="profissional">Profissional</option>
          <option value="engraçado">Engraçado</option>
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleRepurpose}>
          Gerar com IA
        </button>
        {output && (
          <div className="bg-gray-100 p-3 rounded mt-2">
            <p className="text-sm text-gray-600">Resultado:</p>
            <pre className="whitespace-pre-wrap">{output.content}</pre>
          </div>
        )}
        <button className="text-red-500 text-sm mt-4" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export default ModalRepurpose;