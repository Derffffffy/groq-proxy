const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET = 'https://api.groq.com';
const GROQ_PATH = '/openai/v1/chat/completions';

// Прокси middleware – любой запрос на корень / идёт на Groq
app.use('/', createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  pathRewrite: {
    '^/': GROQ_PATH  // заменяем корневой путь на /openai/v1/chat/completions
  },
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Прокидываем авторизацию
      if (req.headers['authorization']) {
        proxyReq.setHeader('Authorization', req.headers['authorization']);
      }
      proxyReq.setHeader('Content-Type', req.headers['content-type'] || 'application/json');
    },
    error: (err, req, res) => {
      console.error('Proxy error:', err.message);
      res.status(502).json({ error: 'Bad Gateway', message: 'Proxy failed to connect to Groq.' });
    }
  },
  proxyTimeout: 30000,
  timeout: 30000
}));

// Healthcheck для keep-alive и проверки
app.get('/healthcheck', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Авто-пинг себя, чтобы Render не засыпал
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
if (SELF_URL && !SELF_URL.includes('localhost')) {
  setInterval(async () => {
    try {
      await fetch(SELF_URL + '/healthcheck');
      console.log('Keep-alive ping sent');
    } catch (e) {
      console.error('Keep-alive ping failed:', e.message);
    }
  }, 14 * 60 * 1000); // каждые 14 минут
}

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
  console.log(`Self-ping URL: ${SELF_URL}/healthcheck`);
});
