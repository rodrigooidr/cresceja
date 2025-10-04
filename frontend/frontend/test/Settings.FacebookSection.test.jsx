import { screen, waitFor } from '@testing-library/react';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders.jsx';

describe('Settings - Facebook gate', () => {
  beforeEach(() => {
    global.setFeatureGate(
      { calendar: true, facebook: true, instagram: true, whatsapp: true },
      { calendar: 1, facebook_pages: 1, instagram_accounts: 1, wa_numbers: 1 }
    );
  });

  test('esconde quando feature desabilitada', async () => {
    global.setFeatureGate({ facebook: false }, { facebook_pages: 1 });
    renderWithRouterProviders(<SettingsPage />, { org: { selected: 'org_test', orgs: [{ id: 'org_test', name: 'Org Test' }] } });
    await waitFor(() => {
      expect(screen.queryByTestId('settings-facebook-section')).toBeNull();
    });
  });

  test('esconde quando limit = 0', async () => {
    global.setFeatureGate({ facebook: true }, { facebook_pages: 0 });
    renderWithRouterProviders(<SettingsPage />, { org: { selected: 'org_test', orgs: [{ id: 'org_test', name: 'Org Test' }] } });
    await waitFor(() => {
      expect(screen.queryByTestId('settings-facebook-section')).toBeNull();
    });
  });

  test('mostra quando habilitada e limit > 0', async () => {
    global.setFeatureGate({ facebook: true }, { facebook_pages: 1 });
    renderWithRouterProviders(<SettingsPage />, { org: { selected: 'org_test', orgs: [{ id: 'org_test', name: 'Org Test' }] } });
    expect(await screen.findByTestId('settings-facebook-section')).toBeInTheDocument();
  });
});
