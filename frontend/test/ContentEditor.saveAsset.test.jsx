import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ContentEditor from '../src/pages/marketing/ContentEditor.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';

jest.mock('../src/api');
import api from '../src/api';
const mockToast = jest.fn();
jest.mock('../src/hooks/useToastFallback.js', () => () => mockToast);

mockFeatureGate();

beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockResolvedValue({ data: { asset_refs: [] } });
  api.post.mockResolvedValue({ data: { ok: true } });
  api.patch.mockResolvedValue({ data: { ok: true } });
  mockToast.mockReset();
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  if (typeof window !== 'undefined') {
    window.URL.createObjectURL = global.URL.createObjectURL;
  }
});

test('saves asset and patches suggestion', async () => {
  HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(['img'], { type:'image/jpeg' }));
  api.post.mockImplementation((url) => {
    if (url === '/uploads/sign') return Promise.resolve({ data:{ url:'https://s3/sign', objectUrl:'https://s3/obj' } });
    if (url === '/orgs/org-1/assets') return Promise.resolve({ data:{ asset_id:'asset1' } });
    return Promise.resolve({ data:{} });
  });
  global.fetch = jest.fn(() => Promise.resolve({ ok:true }));

  window.history.pushState({}, '', '/marketing/editor/s1');
  renderWithProviders(
    <Routes>
      <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
    </Routes>
  );

  const file = new File(['img'], 'test.jpg', { type:'image/jpeg' });
  await screen.findByTestId('file-input');
  fireEvent.change(screen.getByTestId('file-input'), { target:{ files:[file] } });

  await act(async () => {
    fireEvent.click(screen.getByText('Salvar'));
  });

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/uploads/sign', expect.any(Object)));
  expect(api.post).toHaveBeenCalledWith('/orgs/org-1/assets', expect.any(Object));
  expect(api.patch).toHaveBeenCalledWith('/orgs/org-1/suggestions/s1', { asset_refs:[{ asset_id:'asset1', type:'image' }] });
  expect(mockToast).toHaveBeenCalledWith({ title:'Salvo' });
});
