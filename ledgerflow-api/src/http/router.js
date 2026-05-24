import { timingSafeEqual } from 'node:crypto';
import { HttpError } from './http-error.js';
import { applyCors, sendError, sendJson } from './responses.js';

export class Router {
  constructor(context) {
    this.context = context;
    this.routes = [];
  }

  get(path, handler) {
    this.register('GET', path, handler);
  }

  post(path, handler) {
    this.register('POST', path, handler);
  }

  register(method, path, handler) {
    const keys = [];
    const pattern = path
      .split('/')
      .map((part) => {
        if (!part.startsWith(':')) {
          return part;
        }

        keys.push(part.slice(1));
        return '([^/]+)';
      })
      .join('/');

    this.routes.push({
      method,
      handler,
      keys,
      regex: new RegExp(`^${pattern}$`),
    });
  }

  async handle(request, response) {
    applyCors(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const route = this.match(request.method, url.pathname);

    if (!route) {
      sendJson(response, 404, {
        success: false,
        error: { message: 'Route not found' },
      });
      return;
    }

    try {
      this.authorize(request, url.pathname);
      const payload = await route.handler({
        ...this.context,
        request,
        query: url.searchParams,
        params: route.params,
      });

      sendJson(response, payload?.status || 200, payload?.body ?? payload);
    } catch (error) {
      sendError(response, error instanceof Error ? error : new HttpError(500, 'Internal server error'));
    }
  }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }

      const match = route.regex.exec(pathname);

      if (!match) {
        continue;
      }

      return {
        ...route,
        params: Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])])),
      };
    }

    return null;
  }

  authorize(request, pathname) {
    const key = this.context.settings.clientApiKey;

    if (!key || !pathname.startsWith('/api/')) {
      return;
    }

    const headerName = this.context.settings.clientApiKeyHeader.toLowerCase();
    const value = request.headers[headerName];
    const provided = Array.isArray(value) ? value[0] : value;

    if (!provided || !safeEquals(provided, key)) {
      throw new HttpError(401, 'A valid API key is required');
    }
  }
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
