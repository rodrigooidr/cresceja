import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import useApproval from "../src/pages/marketing/hooks/useApproval.js";
import inboxApi from "../src/api/inboxApi.js";

function Harness({ onReady }) {
  const hook = useApproval();
  React.useEffect(() => onReady?.(hook), [hook, onReady]);
  return (
    <div>
      <button onClick={() => hook.approve({ jobId: 'j1', suggestionId: 's1' })}>go</button>
      {hook.approving && <span data-testid="busy">busy</span>}
      <div data-testid="state">{JSON.stringify(hook.state)}</div>
    </div>
  );
}

describe("useApproval", () => {
  beforeEach(() => inboxApi.__mock?.reset?.());

  it("aprova com sucesso e altera estados", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByTestId('busy')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('busy')).not.toBeInTheDocument());
    const st = JSON.parse(screen.getByTestId('state').textContent);
    expect(st.job).toBe('ok');
    expect(st.suggestion).toBe('ok');
    expect(st.error).toBe(null);
  });

  it("marca parcial quando sugestão falha N vezes", async () => {
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/[^/]+\/approve$/, { status: 503 });
    render(<Harness />);
    fireEvent.click(screen.getByText('go'));
    await waitFor(() => {
      const st = JSON.parse(screen.getByTestId('state').textContent);
      expect(st.error).toBe('partial');
    }, { timeout: 5000 });
  });
});
