import React from "react";

function BreadcrumbItem({ item, isLast }) {
  if (!item?.label) return null;
  if (isLast || !item.href) {
    return <span className="text-slate-600" aria-current={isLast ? "page" : undefined}>{item.label}</span>;
  }
  return (
    <a href={item.href} className="text-slate-500 hover:text-slate-700 transition" data-testid={item.testId}>
      {item.label}
    </a>
  );
}

export default function PageHeader({
  title,
  description,
  breadcrumb = [],
  actions = null,
}) {
  const items = Array.isArray(breadcrumb) ? breadcrumb.filter(Boolean) : [];

  return (
    <header className="mb-6 border-b border-slate-200 pb-4">
      {items.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-2" data-testid="breadcrumb">
            {items.map((item, index) => (
              <li key={item.key || item.label || index} className="flex items-center gap-2">
                <BreadcrumbItem item={item} isLast={index === items.length - 1} />
                {index < items.length - 1 && <span className="text-slate-300">/</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900" data-testid="page-title">
            {title}
          </h1>
          {description && <p className="text-sm text-slate-600 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
