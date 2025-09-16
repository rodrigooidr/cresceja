import React from "react";
import BulkApprovalBar from "./BulkApprovalBar.jsx";

export default {
  title: "Marketing/BulkApprovalBar",
  component: BulkApprovalBar,
};

export const Idle = {
  args: {
    count: 3,
    running: false,
    progress: null,
    onStart: () => console.log("start"),
    onCancel: () => console.log("cancel"),
  },
};

export const EmAndamento = {
  args: {
    count: 5,
    running: true,
    progress: { done: 2, total: 5, ok: 2, partial: 0, fail: 0 },
    onStart: () => {},
    onCancel: () => console.log("cancel"),
  },
};
