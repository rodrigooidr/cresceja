import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ContentEditor from '../src/pages/marketing/ContentEditor.jsx';

const mockApi = { post: jest.fn(), patch: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => () => ({ activeOrg: 'org1' }));
const mockToast = jest.fn();
jest.mock('../src/hooks/useToastFallback.js', () => () => mockToast);

beforeEach(() => {
  mockApi.post.mockReset();
  mockApi.patch.mockReset();
  mockToast.mockReset();
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  if (typeof window !== 'undefined') {
    window.URL.createObjectURL = global.URL.createObjectURL;
  }
});

test('saves asset and patches suggestion', async () => {
  HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(['img'], { type:'image/jpeg' }));
  mockApi.post.mockImplementation((url) => {
    if (url === '/uploads/sign') return Promise.resolve({ data:{ url:'https://s3/sign', objectUrl:'https://s3/obj' } });
    if (url === '/orgs/org1/assets') return Promise.resolve({ data:{ asset_id:'asset1' } });
    return Promise.resolve({ data:{} });
  });
  mockApi.patch.mockResolvedValue({});
  global.fetch = jest.fn(() => Promise.resolve({ ok:true }));

  render(
    <MemoryRouter initialEntries={['/marketing/editor/s1']}>
      <Routes>
        <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
      </Routes>
    </MemoryRouter>
  );

  const file = new File(['img'], 'test.jpg', { type:'image/jpeg' });
  await screen.findByTestId('file-input');
  fireEvent.change(screen.getByTestId('file-input'), { target:{ files:[file] } });

  await act(async () => {
    fireEvent.click(screen.getByText('Salvar'));
  });

  await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/uploads/sign', expect.any(Object)));
  expect(mockApi.post).toHaveBeenCalledWith('/orgs/org1/assets', expect.any(Object));
  expect(mockApi.patch).toHaveBeenCalledWith('/orgs/org1/suggestions/s1', { asset_refs:[{ asset_id:'asset1', type:'image' }] });
  expect(mockToast).toHaveBeenCalledWith({ title:'Salvo' });
});
