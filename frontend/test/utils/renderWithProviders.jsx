import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthContext } from '../../src/contexts/AuthContext';
import { OrgContext } from '../../src/contexts/OrgContext';

// Permite forçar recursos em testes
const DefaultFeatureContext = React.createContext({ has: () => true });

export function renderWithProviders(ui, {
  user = { id:'u1', name:'Tester', role:'SuperAdmin', org_id:'org-1' },
  org = { selected:'org-1', orgs:[{id:'org-1', name:'Org One'}] },
  features = { has: () => true },
  routes = true,
} = {}) {
  const authValue = { user, isAuthenticated: !!user, loading:false };
  const orgValue = {
    orgs: org.orgs, selected: org.selected, setSelected: ()=>{},
    loading:false, canSeeSelector:true, searchOrgs:()=>{}, loadMoreOrgs:()=>{},
    hasMore:false, q:'', publicMode:false
  };

  const Wrapper = ({ children }) => (
    <AuthContext.Provider value={authValue}>
      <OrgContext.Provider value={orgValue}>
        <DefaultFeatureContext.Provider value={features}>
          {routes ? <BrowserRouter>{children}</BrowserRouter> : children}
        </DefaultFeatureContext.Provider>
      </OrgContext.Provider>
    </AuthContext.Provider>
  );
  return render(ui, { wrapper: Wrapper });
}

// Helper de feature gate para testes (se o app usa <FeatureGate/> real)
export function mockFeatureGate(always = true) {
  const mockAlways = always;
  jest.mock('../../src/ui/feature/FeatureGate.jsx', () => ({
    FeatureGate: ({ code, children }) => (mockAlways ? children : null)
  }));
}
