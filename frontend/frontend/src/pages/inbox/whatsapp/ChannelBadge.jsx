import React from "react";

const LABELS = { whatsapp: "WA", instagram: "IG", facebook: "FB" };

export default function ChannelBadge({ channel = "whatsapp" }) {
  const label = LABELS[channel] || channel;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 mr-1" data-testid="channel-badge">
      {label}
    </span>
  );
}
