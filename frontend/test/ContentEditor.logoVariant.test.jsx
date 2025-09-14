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
  api.get.mockResolvedValue({ data:{ asset_refs:[{ asset_id:'old', type:'image' }] } });
  api.post.mockResolvedValue({ data:{ ok:true } });
  api.patch.mockResolvedValue({ data:{ ok:true } });
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
  HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(['img'], { type:'image/jpeg' }));
  global.fetch = jest.fn(() => Promise.resolve({ ok:true }));
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
});

test('saves variant with logo', async () => {
  api.post.mockImplementation((url) => {
    if (url === '/uploads/sign') return Promise.resolve({ data:{ url:'https://s3/sign', objectUrl:'https://s3/obj' } });
    if (url === '/orgs/org-1/assets') return Promise.resolve({ data:{ asset_id:'asset1' } });
    return Promise.resolve({ data:{} });
  });

  window.history.pushState({}, '', '/marketing/editor/s1');
  renderWithProviders(
    <Routes>
      <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
    </Routes>
  );
  const file = new File(['img'], 't.jpg', { type:'image/jpeg' });
  await screen.findByTestId('logo-input');
  fireEvent.change(screen.getByTestId('logo-input'), { target:{ files:[file] } });
  await act(async () => {
    fireEvent.click(screen.getByText('Salvar variação'));
  });
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/orgs/org-1/assets', expect.any(Object)));
  const patchCall = api.patch.mock.calls[0];
  expect(patchCall[1].asset_refs).toHaveLength(2);
  expect(mockToast).toHaveBeenCalled();
});
