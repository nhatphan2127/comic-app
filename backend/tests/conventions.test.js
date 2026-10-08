// Cross-cutting API conventions: versioning, error format, documentation.
import { describe, it, expect } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { api, raw } from './helpers.js';
import { openapiDocument } from '../src/docs/docsRoutes.js';
import { mounts } from '../src/routes/index.js';

describe('versioning', () => {
  it('the API lives under /api/v1; unversioned paths are gone', async () => {
    expect((await api().get('/comics')).status).toBe(200);
    for (const path of ['/comics', '/api/comics', '/user/profile']) {
      expect((await raw().get(path)).status, path).toBe(404);
    }
  });

  it('the root lists the available versions', async () => {
    const res = await raw().get('/');
    expect(res.body.data.versions).toEqual({ v1: '/api/v1' });
  });
});

describe('errors', () => {
  it('unknown routes answer a JSON 404 problem, not an HTML page', async () => {
    const res = await api().get('/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No route for GET /api/v1/nope',
      instance: '/api/v1/nope',
    });
  });

  it('malformed JSON bodies are a 400 problem', async () => {
    const res = await api().post('/auth/login').set('Content-Type', 'application/json').send('{"userName":');
    expect(res.status).toBe(400);
    expect(res.body.status).toBe(400);
  });
});

describe('OpenAPI documentation', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    await expect(SwaggerParser.validate(structuredClone(openapiDocument))).resolves.toBeTruthy();
  });

  it('is served as JSON and as Swagger UI', async () => {
    const json = await raw().get('/api/v1/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe('3.1.0');

    const ui = await raw().get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
  });

  // Every Express route must be documented, and every documented operation must exist.
  it('documents exactly the routes the server implements', () => {
    const implemented = new Set();
    for (const [base, router] of mounts) {
      for (const layer of router.stack) {
        if (!layer.route) continue;
        const path = `${base}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');
        for (const method of Object.keys(layer.route.methods)) implemented.add(`${method.toUpperCase()} ${path}`);
      }
    }

    const documented = new Set();
    const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
    for (const [path, item] of Object.entries(openapiDocument.paths)) {
      for (const method of METHODS) if (item[method]) documented.add(`${method.toUpperCase()} ${path}`);
    }

    expect([...implemented].filter((op) => !documented.has(op)), 'routes missing from openapi.yaml').toEqual([]);
    expect([...documented].filter((op) => !implemented.has(op)), 'documented but not implemented').toEqual([]);
  });
});
