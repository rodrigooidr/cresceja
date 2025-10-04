import React from 'react';

const channels = ['whatsapp', 'instagram', 'facebook'];

function ChannelSelector({ selected, onSelect }) {
  return (
    <div className="flex gap-2">
      {channels.map(c => (
        <button
          key={c}
          className={\`px-3 py-1 rounded \${selected === c ? 'bg-blue-600 text-white' : 'bg-gray-200'}\`}
          onClick={() => onSelect(c)}
        >
          {c.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default ChannelSelector;