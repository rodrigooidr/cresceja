import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';

const mockApi = {
  get: jest.fn(),
  post: jest.fn()
};

jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => () => ({ activeOrg: 'org1' }));

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
});

test('lists campaigns and suggestions and approves', async () => {
  mockApi.get.mockImplementation((url) => {
    if (url === `/orgs/org1/campaigns`) {
      return Promise.resolve({ data: { data: [{ id: 'c1', title: 'Camp 1' }] } });
    }
    if (url === `/orgs/org1/campaigns/c1/suggestions`) {
      return Promise.resolve({ data: { data: [{ id: 's1', date: '2024-01-01', time: '10:00', copy_json: { text: 'Olá' } }] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  mockApi.post.mockResolvedValue({ data: {} });

  render(<ContentCalendar />);

  await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith(`/orgs/org1/campaigns`, expect.any(Object)));

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });

  await waitFor(() => screen.getByText('Olá'));

  fireEvent.click(screen.getByText('Aprovar'));
  await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith(`/orgs/org1/suggestions/s1/approve`));
});
