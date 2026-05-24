export function applyCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-ledgerflow-api-key');
}

export function sendJson(response, status, payload) {
  applyCors(response);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

export function sendError(response, error) {
  const status = Number(error.status || 500);
  const payload = {
    success: false,
    error: {
      message: status >= 500 ? 'Internal server error' : error.message,
      details: error.details,
    },
  };

  sendJson(response, status, payload);
}
