import React, { useEffect } from "react";
import GovLogsPage from "./GovLogsPage.jsx";
import inboxApi from "../../api/inboxApi.js";

export default {
  title: "Marketing/Governança & Logs",
  component: GovLogsPage,
  parameters: { layout: "fullscreen" },
};

export const Basico = {
  args: {},
  render: (args) => {
    useEffect(() => {
      inboxApi.__mock?.reset?.();
      Promise.all([
        inboxApi.post("/gov/logs", { event: "marketing.approve.success", payload: { jobId: "j1", suggestionId: "s1", bulk: false } }),
        inboxApi.post("/gov/logs", { event: "marketing.approve.partial", payload: { jobId: "j2", suggestionId: "s2", bulk: true, status: 503 } }),
        inboxApi.post("/gov/logs", { event: "marketing.revert.success", payload: { jobId: "j1", suggestionId: "s1" } }),
      ]);
    }, []);
    return <GovLogsPage {...args} />;
  },
};
