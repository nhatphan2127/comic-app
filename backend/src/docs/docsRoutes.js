// API documentation: the OpenAPI document (openapi.yaml, written by hand) and Swagger UI to browse it.
//   GET /api/docs                 Swagger UI
//   GET /api/v1/openapi.json      the raw OpenAPI 3.1 document (for code generators, Postman, ...)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const openapiDocument = YAML.parse(fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8'));

const router = express.Router();

router.get('/v1/openapi.json', (req, res) => res.json(openapiDocument));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, { customSiteTitle: 'Comic API docs' }));

export default router;
