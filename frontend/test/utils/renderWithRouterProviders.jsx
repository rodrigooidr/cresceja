import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthContext } from '../../src/contexts/AuthContext';
import { OrgContext } from '../../src/contexts/OrgContext';

// opcional: se existir um Feature context/hook central
const FeaturesContext = React.createContext({ has: () => true });

export function renderWithRouterProviders(
  ui,
  {
    route = '/',                 // rota inicial
    user = { id:'u1', name:'Tester', role:'SuperAdmin', org_id:'org-1' },
    org = { selected:'org-1', orgs:[{id:'org-1', name:'Org One'}] },
    features = { has: () => true },
  } = {}
) {
  if (typeof window !== 'undefined' && route) {
    window.history.pushState({}, '', route);
  }
  const auth = { user, isAuthenticated: !!user, loading: false };
  const orgValue = {
    orgs: org.orgs, selected: org.selected, setSelected: () => {},
    loading: false, canSeeSelector: true,
    searchOrgs: () => {}, loadMoreOrgs: () => {},
    hasMore: false, q: '', publicMode: !auth.isAuthenticated,
  };

  const Wrapper = ({ children }) => (
    <AuthContext.Provider value={auth}>
      <OrgContext.Provider value={orgValue}>
        <FeaturesContext.Provider value={features}>
          <MemoryRouter initialEntries={[route]}>
            {children}
          </MemoryRouter>
        </FeaturesContext.Provider>
      </OrgContext.Provider>
    </AuthContext.Provider>
  );

  return render(ui, { wrapper: Wrapper });
}
