import React, { useEffect } from "react";
import WhatsAppInbox from "./WhatsAppInbox.jsx";
import inboxApi from "../../../api/inboxApi";

export default { title: "Inbox/WhatsAppInbox", component: WhatsAppInbox, parameters: { layout: "fullscreen" } };

export const Cloud = {
  render: (args) => {
    useEffect(() => {
      inboxApi.__mock?.reset?.();
      inboxApi.__mock?.waInjectIncoming?.({ chatId: "5599", text: "olá!" });
      inboxApi.__mock?.waInjectIncoming?.({ chatId: "5588", text: "tudo bem?" });
    }, []);
    return <WhatsAppInbox transport="cloud" {...args} />;
  },
};

export const Baileys = {
  render: (args) => {
    useEffect(() => {
      inboxApi.__mock?.reset?.();
      inboxApi.__mock?.waInjectIncoming?.({ chatId: "5577", text: "oi do Baileys" });
    }, []);
    return <WhatsAppInbox transport="baileys" {...args} />;
  },
};
