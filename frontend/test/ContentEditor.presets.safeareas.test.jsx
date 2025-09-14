import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ContentEditor from '../src/pages/marketing/ContentEditor.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';

jest.mock('../src/api');
import api from '../src/api';
jest.mock('../src/hooks/useToastFallback.js', () => () => jest.fn());

mockFeatureGate();

beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockResolvedValue({ data:{} });
  api.post.mockResolvedValue({ data:{ ok:true } });
  api.patch.mockResolvedValue({ data:{ ok:true } });
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
});

test('changing preset adjusts canvas and renders safe area', async () => {
  window.history.pushState({}, '', '/marketing/editor/s1');
  renderWithProviders(
    <Routes>
      <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
    </Routes>
  );
  const buttons = await screen.findAllByTestId('preset-btn');
  await act(async () => {
    fireEvent.click(buttons[1]);
  });
  const canvas = screen.getByTestId('canvas');
  expect(canvas.width).not.toBe(0);
  expect(screen.getByTestId('safe-area')).toBeInTheDocument();
});
