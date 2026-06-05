import app from './app.js';

/** Mount Express API on the Vite dev server (same port as the React app). */
export default function apiPlugin() {
  return {
    name: 'crm-api',
    configureServer(viteServer) {
      viteServer.middlewares.use(app);
      console.log('[crm-api] REST API mounted at /api/*');
    },
    configurePreviewServer(previewServer) {
      previewServer.middlewares.use(app);
      console.log('[crm-api] REST API mounted at /api/* (preview)');
    },
  };
}
