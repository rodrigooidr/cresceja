import React from 'react';

function ChannelCard({ title, children, testId }) {
  return (
    <div data-testid={testId} className="border rounded p-4 mb-4">
      <h3 className="font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}

export default ChannelCard;
