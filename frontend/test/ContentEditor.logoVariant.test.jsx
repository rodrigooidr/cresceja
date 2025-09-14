import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ContentEditor from '../src/pages/marketing/ContentEditor.jsx';

const mockApi = { post: jest.fn(), patch: jest.fn(), get: jest.fn(() => Promise.resolve({ data:{ asset_refs:[{ asset_id:'old', type:'image' }] } })) };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => ({ __esModule:true, default: () => ({ activeOrg: 'org1' }) }));
const mockToast = jest.fn();
jest.mock('../src/hooks/useToastFallback.js', () => () => mockToast);
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ children }) => <>{children}</>);

beforeEach(() => {
  mockApi.post.mockReset();
  mockApi.patch.mockReset();
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
  HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(['img'], { type:'image/jpeg' }));
  global.fetch = jest.fn(() => Promise.resolve({ ok:true }));
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
});

test('saves variant with logo', async () => {
  mockApi.post.mockImplementation((url) => {
    if (url === '/uploads/sign') return Promise.resolve({ data:{ url:'https://s3/sign', objectUrl:'https://s3/obj' } });
    if (url === '/orgs/org1/assets') return Promise.resolve({ data:{ asset_id:'asset1' } });
    return Promise.resolve({ data:{} });
  });
  mockApi.patch.mockResolvedValue({});

  render(
    <MemoryRouter initialEntries={['/marketing/editor/s1']}>
      <Routes>
        <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
      </Routes>
    </MemoryRouter>
  );
  const file = new File(['img'], 't.jpg', { type:'image/jpeg' });
  fireEvent.change(screen.getByTestId('logo-input'), { target:{ files:[file] } });
  fireEvent.click(screen.getByText('Salvar variação'));
  await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/orgs/org1/assets', expect.any(Object), expect.any(Object)));
  const patchCall = mockApi.patch.mock.calls[0];
  expect(patchCall[1].asset_refs).toHaveLength(2);
  expect(mockToast).toHaveBeenCalled();
});
