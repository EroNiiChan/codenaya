/**
 * Run in the app directory after a re-install. Vite caches failed package
 * resolutions and its optimized deps, so an import of a package installed
 * after it started stays broken. Touching its config restarts it in place on
 * the same port, and its client reloads the page. A no-op for other servers.
 */
export const RESTART_VITE_COMMAND =
  'for f in vite.config.*; do [ -e "$f" ] && touch "$f"; done; true';
