import { render, screen } from "@testing-library/react";
import FacebookSection from "../src/pages/settings/FacebookSection.jsx";

test("fb testa desativado sem página selecionada", () => {
  const org = {
    channels: {
      facebook: {
        connected: true,
        permissions: ["pages_manage_posts", "pages_read_engagement"],
        pages: [],
      },
    },
    features: { facebook: true },
    plan: { limits: { facebook_pages: 1 } },
  };

  render(<FacebookSection org={org} />);
  const btn = screen.getByTestId("fb-test-btn");
  expect(btn).toBeDisabled();
});

