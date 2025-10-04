import React, { useMemo } from "react";
import useActiveOrgGate from "../../hooks/useActiveOrgGate";
import WhatsAppOfficialCard from "../../components/settings/WhatsAppOfficialCard.jsx";
import InstagramCard from "../../components/settings/InstagramCard.jsx";
import FacebookCard from "../../components/settings/FacebookCard.jsx";
import GoogleCalendarCard from "../../components/settings/GoogleCalendarCard.jsx";

export default function ChannelsPage({ minRole = "OrgAdmin" }) {
  const { allowed, reason } = useActiveOrgGate({ minRole, requireActiveOrg: true });
  const tabs = useMemo(
    () => ([
      { key: "whatsapp", label: "WhatsApp", component: <WhatsAppOfficialCard /> },
      { key: "instagram", label: "Instagram", component: <InstagramCard /> },
      { key: "facebook", label: "Facebook", component: <FacebookCard /> },
      { key: "google-calendar", label: "Google Calendar", component: <GoogleCalendarCard /> },
    ]),
    []
  );

  if (!allowed) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-600">Acesso bloqueado: {String(reason || "role/org")}</div>
      </div>
    );
  }

  const [hash] = (typeof window !== "undefined" ? window.location.hash : "#whatsapp").split("?");
  const activeKey = (hash?.replace("#", "") || "whatsapp");
  const setTab = (k) => {
    if (typeof window !== "undefined") window.location.hash = k;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Configurações</h1>

      <div className="border-b mb-4 flex gap-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 -mb-px border-b-2 ${activeKey === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {(tabs.find(t => t.key === activeKey) || tabs[0]).component}
      </div>
    </div>
  );
}

