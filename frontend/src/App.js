// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ChatPage from './pages/Omnichannel/ChatPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/omnichannel/chat" replace />} />
        <Route path="/omnichannel/chat" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}