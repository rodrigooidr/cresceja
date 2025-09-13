import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InstagramPublisher from './InstagramPublisher.jsx';
import inboxApi from '../../api/inboxApi.js';
import { OrgContext } from '../../contexts/OrgContext.jsx';

jest.mock('../../api/inboxApi.js');

function renderWithOrg(ui) {
  return render(<OrgContext.Provider value={{ selected: 'org1' }}>{ui}</OrgContext.Provider>);
}

test('validates media required', async () => {
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: 'a1', ig_user_id: 'u', username: 'u' }] });
  renderWithOrg(<InstagramPublisher />);
  await screen.findByText('Instagram Publisher');
  fireEvent.click(screen.getByText('Publicar agora'));
  expect(await screen.findByText('Mídia obrigatória')).toBeInTheDocument();
});

test('publish and handle errors', async () => {
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: 'a1', ig_user_id: 'u', username: 'u' }] });
  inboxApi.post.mockResolvedValueOnce({ data: { status: 'done' } });
  renderWithOrg(<InstagramPublisher />);
  await screen.findByText('Instagram Publisher');
  fireEvent.change(screen.getByPlaceholderText('URL da mídia'), { target: { value: 'http://img' } });
  fireEvent.click(screen.getByText('Publicar agora'));
  await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());

  inboxApi.get.mockResolvedValueOnce({ data: [{ id: 'a1', ig_user_id: 'u', username: 'u' }] });
  inboxApi.post.mockRejectedValueOnce({ response: { data: { error: 'feature_limit_reached' } } });
  renderWithOrg(<InstagramPublisher />);
  await screen.findByText('Instagram Publisher');
  fireEvent.change(screen.getByPlaceholderText('URL da mídia'), { target: { value: 'http://img' } });
  fireEvent.click(screen.getByText('Publicar agora'));
  expect(await screen.findByText('Limite do plano atingido')).toBeInTheDocument();

  inboxApi.get.mockResolvedValueOnce({ data: [{ id: 'a1', ig_user_id: 'u', username: 'u' }] });
  inboxApi.post.mockRejectedValueOnce({ response: { data: { error: 'reauth_required' } } });
  renderWithOrg(<InstagramPublisher />);
  await screen.findByText('Instagram Publisher');
  fireEvent.change(screen.getByPlaceholderText('URL da mídia'), { target: { value: 'http://img' } });
  fireEvent.click(screen.getByText('Publicar agora'));
  expect(await screen.findByText('Reautorização necessária')).toBeInTheDocument();
});
