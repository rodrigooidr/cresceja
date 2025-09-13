import React from "react";

export default function FormField({
  label, name, required=false, error, children, hint,
}) {
  const hasError = !!error;
  return (
    <div className="mb-3">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <div className={hasError ? "mt-1 ring-1 ring-red-400 rounded" : "mt-1"}>
        {children}
      </div>
      {hasError && (
        <p className="mt-1 text-sm text-red-600" role="alert">{error.message}</p>
      )}
      {!hasError && hint && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}
