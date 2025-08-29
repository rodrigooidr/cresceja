import React from 'react';

function Step({ children }) {
  return <div data-testid="wizard-step">{children}</div>;
}

export default Step;
