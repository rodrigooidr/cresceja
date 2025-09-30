import React from 'react';

export default function AdminSectionCard({ title, subtitle, right, children }) {
  return (
    <section className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <div className="card-title">{title}</div>
          {subtitle ? <div className="card-subtitle text-muted">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}
