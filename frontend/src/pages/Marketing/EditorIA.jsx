import React, { useState } from 'react';

function EditorIA() {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [generated, setGenerated] = useState('');

  const gerarComIA = () => {
    const texto = \`📢 \${title}\n\${caption} #promoção\`;
    setGenerated(texto);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Editor de Conteúdo com IA</h1>

      <input
        className="border p-2 rounded w-full mb-3"
        placeholder="Título do post"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className="border p-2 rounded w-full mb-3"
        placeholder="Texto base ou instrução"
        rows={4}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />

      <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={gerarComIA}>
        Gerar com IA
      </button>

      {generated && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <h3 className="font-semibold mb-1">Prévia do conteúdo:</h3>
          <p>{generated}</p>
        </div>
      )}
    </div>
  );
}

export default EditorIA;