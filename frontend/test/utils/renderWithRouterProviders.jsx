import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthContext } from '../../src/contexts/AuthContext';
import { OrgContext } from '../../src/contexts/OrgContext';

export function renderWithRouterProviders(
  ui,
  {
    route = '/',
    user = { id: 'u1', name: 'Tester', role: 'SuperAdmin', org_id: 'org-1' },
    org = { selected: 'org-1', orgs: [{ id: 'org-1', name: 'Org One' }] },
    features = { has: () => true },
    withRouter = true,
  } = {},
) {
  const auth = { user, isAuthenticated: !!user, loading: false };
  const orgValue = {
    orgs: org.orgs,
    selected: org.selected,
    setSelected: () => {},
    loading: false,
    canSeeSelector: true,
    searchOrgs: () => {},
    loadMoreOrgs: () => {},
    hasMore: false,
    q: '',
    publicMode: !auth.isAuthenticated,
  };

  const FeaturesContext = React.createContext({ has: () => true });

  const Body = ({ children }) => (
    <AuthContext.Provider value={auth}>
      <OrgContext.Provider value={orgValue}>
        <FeaturesContext.Provider value={features}>
          {children}
        </FeaturesContext.Provider>
      </OrgContext.Provider>
    </AuthContext.Provider>
  );

  if (withRouter) {
    return render(
      <Body>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </Body>,
    );
  }

  // sem Router (para componentes que já têm BrowserRouter dentro)
  return render(<Body>{ui}</Body>);
}

