import http from 'http';

const PORT = Number(process.env.PORT || 4000);

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
};

const server = http.createServer((req, res) => {
  if (!req.url) {
    return sendJson(res, 400, { error: 'Invalid request' });
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'cca-backend',
      timestamp: new Date().toISOString(),
      message: 'Backend opérationnel sans Google Gemini API',
    });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend CCA démarré sur http://0.0.0.0:${PORT}`);
});

