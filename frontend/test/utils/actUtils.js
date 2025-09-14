import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";

export async function renderAct(ui, options) {
  let utils;
  await act(async () => {
    utils = render(ui, options);
    await Promise.resolve();
  });
  return utils;
}

export async function actTick(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

