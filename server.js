// Dev server for the v0 preview only.
// Replicates Vercel's static + /api serverless behavior so the SPA can be
// tested locally (login, saving products, orders, image upload).
// Vercel itself ignores this file and serves index.html + /api/*.js natively.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function decorateRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (data) => {
    if (typeof data === 'object' && data !== null) return res.json(data);
    res.end(data == null ? '' : String(data));
    return res;
  };
  return res;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname, query) {
  const name = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const file = path.join(ROOT, 'api', `${name}.js`);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: `API não encontrada: ${pathname}` });
  }

  let handler;
  try {
    delete require.cache[require.resolve(file)];
    handler = require(file);
  } catch (e) {
    console.error('[v0] Falha ao carregar handler', file, e);
    return res.status(500).json({ error: 'Falha ao carregar a função de API.' });
  }

  req.query = query;
  req.cookies = parseCookies(req.headers.cookie || '');

  const bodyParserOff = handler.config && handler.config.api && handler.config.api.bodyParser === false;
  if (!bodyParserOff && req.method !== 'GET' && req.method !== 'HEAD') {
    const raw = await readBody(req);
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('application/json')) {
      try { req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; }
      catch { req.body = {}; }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      req.body = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
    } else {
      req.body = raw;
    }
  }

  try {
    await handler(req, res);
  } catch (e) {
    console.error('[v0] Erro no handler', pathname, e);
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Erro interno.' });
  }
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback
    const indexPath = path.join(ROOT, 'index.html');
    res.setHeader('Content-Type', MIME['.html']);
    return res.end(fs.readFileSync(indexPath));
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  decorateRes(res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, query);
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (e) {
    console.error('[v0] Erro no servidor', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erro no servidor.' });
  }
});

server.listen(PORT, () => {
  console.log(`[v0] Dev server rodando em http://localhost:${PORT}`);
});
