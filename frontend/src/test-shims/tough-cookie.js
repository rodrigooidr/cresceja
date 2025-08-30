class Store {}
class MemoryCookieStore extends Store {}
class Cookie {}
class CookieJar {}
function domainMatch() { return true; }
function pathMatch() { return true; }

module.exports = {
  Store,
  MemoryCookieStore,
  Cookie,
  CookieJar,
  domainMatch,
  pathMatch,
};

