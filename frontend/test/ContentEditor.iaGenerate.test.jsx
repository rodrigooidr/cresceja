import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ContentEditor from '../src/pages/marketing/ContentEditor.jsx';

const mockApi = { post: jest.fn(), patch: jest.fn(), get: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => () => ({ activeOrg: 'org1' }));
const mockToast = jest.fn();
jest.mock('../src/hooks/useToastFallback.js', () => () => mockToast);

beforeEach(() => {
  mockApi.post.mockReset();
  mockToast.mockReset();
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
});

test('generates image with IA and inserts', async () => {
  const imgMock = { onload:null, _src:'', set src(v){ this._src=v; this.onload && this.onload(); } };
  global.Image = class { constructor(){ return imgMock; } };
  mockApi.post.mockImplementation((url) => {
    if (url === '/orgs/org1/ai/images/generate') return Promise.resolve({ data:{ assets:[{ url:'http://ai.img' }] } });
    return Promise.resolve({ data:{} });
  });
  render(
    <MemoryRouter initialEntries={['/marketing/editor/s1']}>
      <Routes>
        <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByText('Gerar com IA');
  await act(async () => {
    fireEvent.click(screen.getByText('Gerar com IA'));
  });
  await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/orgs/org1/ai/images/generate', expect.any(Object)));
  expect(imgMock._src).toBe('http://ai.img');
});

test('shows error when quota reached', async () => {
  mockApi.post.mockImplementation((url) => {
    if (url === '/orgs/org1/ai/images/generate') return Promise.reject({ response:{ data:{ error:'feature_limit_reached' } } });
    return Promise.resolve({ data:{} });
  });
  render(
    <MemoryRouter initialEntries={['/marketing/editor/s1']}>
      <Routes>
        <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByText('Gerar com IA');
  await act(async () => {
    fireEvent.click(screen.getByText('Gerar com IA'));
  });
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ title:'Limite do plano atingido', status:'error' }));
});
