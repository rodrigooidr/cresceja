import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ContentEditor from '../src/pages/marketing/ContentEditor.jsx';

const mockApi = { post: jest.fn(), patch: jest.fn(), get: jest.fn(() => Promise.resolve({ data:{} })) };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => ({ __esModule:true, default: () => ({ activeOrg: 'org1' }) }));
jest.mock('../src/hooks/useToastFallback.js', () => () => jest.fn());
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ children }) => <>{children}</>);

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = () => ({ clearRect: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillText: jest.fn() });
});

test('changing preset adjusts canvas and renders safe area', () => {
  render(
    <MemoryRouter initialEntries={['/marketing/editor/s1']}>
      <Routes>
        <Route path="/marketing/editor/:suggestionId" element={<ContentEditor />} />
      </Routes>
    </MemoryRouter>
  );
  const buttons = screen.getAllByTestId('preset-btn');
  fireEvent.click(buttons[1]);
  const canvas = screen.getByTestId('canvas');
  expect(canvas.width).not.toBe(0);
  expect(screen.getByTestId('safe-area')).toBeInTheDocument();
});
