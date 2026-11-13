import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildOpenApiSpec } from '../services/apiSchema.service.js';
import { logger } from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
  try {
    const spec = buildOpenApiSpec({
      baseUrl: process.env.BACKEND_BASE_URL || 'http://localhost:4000',
    });

    // docs/openapi.json is the committed contract external consumers read, and CI
    // regenerates it here and fails on a diff. The path is therefore fixed, not a flag:
    // writing the snapshot anywhere else would silently defeat that check.
    const outputPath = path.resolve(__dirname, '../../docs/openapi.json');

    const docsDir = path.dirname(outputPath);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
    logger.info(`OpenAPI spec generated at ${outputPath}`);
  } catch (error) {
    logger.error({ error }, 'Failed to generate OpenAPI spec');
    process.exit(1);
  }
};

main();
