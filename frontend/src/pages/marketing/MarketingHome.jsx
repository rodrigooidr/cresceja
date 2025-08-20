import React from 'react';
import { Link } from 'react-router-dom';

export default function MarketingHome() {
  return (
    <div className="p-4 space-y-2">
      <h1 className="text-2xl mb-4">Marketing</h1>
      <div className="space-x-4">
        <Link to="lists" className="text-blue-600 underline">Listas</Link>
        <Link to="templates" className="text-blue-600 underline">Templates</Link>
        <Link to="campaigns" className="text-blue-600 underline">Campanhas</Link>
      </div>
    </div>
  );
}
