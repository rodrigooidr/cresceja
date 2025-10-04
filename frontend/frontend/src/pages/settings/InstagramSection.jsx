import React from 'react';
import FeatureGate from '../../ui/feature/FeatureGate.jsx';
import { MetaAccounts } from './FacebookSection.jsx';

export default function InstagramSection() {
  return (
    <FeatureGate code="ig_messaging" fallback={null}>
      <MetaAccounts channel="instagram" />
    </FeatureGate>
  );
}
