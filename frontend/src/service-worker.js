/* eslint-disable */
/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

self.skipWaiting();
clientsClaim();

/**
 * O Workbox injeta a lista no build:
 * - Em CRA + InjectManifest, essa constante precisa existir.
 */
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

/** App Shell para SPA: navegações → /index.html (exceto API e uploads) */
const handler = createHandlerBoundToURL('/index.html');
const denylist = [new RegExp('^/api/'), new RegExp('^/uploads/')];
const navRoute = new NavigationRoute(handler, { denylist });
registerRoute(navRoute);