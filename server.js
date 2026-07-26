const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== НАСТРОЙКИ ==========
const TARGET_URL = 'https://api.groq.com';
const PROXY_PATH = '/openai/v1/chat/completions';

// ========== ПРОКСИ-МИДЛВАРЬ ==========
const proxy = createProxyMiddleware({
  target: TARGET_URL,
  changeOrigin: true,
  pathRewrite: () => PROXY_PATH, // Все запросы идут на /openai/v1/chat/completions
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Прокидываем заголовки авторизации и тип контента
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
  proxyTimeout: 30000,  // 30 секунд на соединение с Groq
  timeout: 30000        // 30 секунд на ответ от Groq
});

app.use('/', proxy);

// ========== KEEP-ALIVE: Пинг самого себя, чтобы Render не усыплял ==========
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`; // Render автоматически задает RENDER_EXTERNAL_URL
const PING_INTERVAL = 14 * 60 * 1000; // 14 минут (Render засыпает через 15 минут без трафика)

if (SELF_URL && !SELF_URL.includes('localhost')) {
  setInterval(async () => {
    try {
      await fetch(SELF_URL + '/healthcheck');
      console.log('Keep-alive ping sent');
    } catch (e) {
      console.error('Keep-alive ping failed:', e.message);
    }
  }, PING_INTERVAL);
}

// ========== HEALTHCHECK ENDPOINT (на всякий случай) ==========
app.get('/healthcheck', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК ==========
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Groq proxy running on port ${PORT}`);
  console.log(`Self-ping URL: ${SELF_URL}/healthcheck`);
});
