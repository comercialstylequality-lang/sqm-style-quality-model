/*
 * Configuração do frontend SQM para a Vercel.
 *
 * Depois de publicar o backend no Replit, coloque aqui a URL pública:
 * apiBaseUrl: "https://seu-backend.replit.app"
 */
window.SQM_CONFIG = window.SQM_CONFIG || {
  apiBaseUrl: ""
};

window.sqmApiUrl = function (path) {
  const base = String(window.SQM_CONFIG.apiBaseUrl || "").replace(/\/+$/, "");
  return base + path;
};

window.sqmFetch = function (path, options) {
  return fetch(window.sqmApiUrl(path), {
    ...(options || {}),
    credentials: "include"
  });
};