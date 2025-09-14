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
  api.get.mockResolvedValue({ data:{} });
  api.post.mockResolvedValue({ data:{ ok:true } });
  api.patch.mockResolvedValue({ data:{ ok:true } });
  mockToast.mockReset();
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
});

test('generates image with IA and inserts', async () => {
  const imgMock = { onload:null, _src:'', set src(v){ this._src=v; this.onload && this.onload(); } };
  global.Image = class { constructor(){ return imgMock; } };
  api.post.mockImplementation((url) => {
    if (url === '/orgs/org-1/ai/images/generate') return Promise.resolve({ data:{ assets:[{ url:'http://ai.img' }] } });
    return Promise.resolve({ data:{} });
  });
  window.history.pushState({}, '', '/marketing/editor/s1');
  renderWithProviders(
    <Routes>
      <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
    </Routes>
  );
  await screen.findByText('Gerar com IA');
  await act(async () => {
    fireEvent.click(screen.getByText('Gerar com IA'));
  });
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/orgs/org-1/ai/images/generate', expect.any(Object)));
  expect(imgMock._src).toBe('http://ai.img');
});

test('shows error when quota reached', async () => {
  api.post.mockImplementation((url) => {
    if (url === '/orgs/org-1/ai/images/generate') return Promise.reject({ response:{ data:{ error:'feature_limit_reached' } } });
    return Promise.resolve({ data:{} });
  });
  window.history.pushState({}, '', '/marketing/editor/s1');
  renderWithProviders(
    <Routes>
      <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
    </Routes>
  );
  await screen.findByText('Gerar com IA');
  await act(async () => {
    fireEvent.click(screen.getByText('Gerar com IA'));
  });
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ title:'Limite do plano atingido', status:'error' }));
});
