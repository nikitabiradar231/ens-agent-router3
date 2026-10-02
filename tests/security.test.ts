import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ENS Agent Router - Static Security & Architecture Audit', () => {

  // TEST 3 — No hardcoded agent registry in router source code
  it('Test 3: Router source code MUST NOT contain hardcoded agent names or endpoint maps', () => {
    const routerDir = path.resolve(__dirname, '../src/router');
    const files = fs.readdirSync(routerDir).filter(f => f.endsWith('.ts'));

    let combinedCode = '';
    for (const file of files) {
      combinedCode += fs.readFileSync(path.join(routerDir, file), 'utf-8');
    }

    // Verify router code does not contain hardcoded agent lists or maps
    expect(combinedCode).not.toMatch(/const\s+agents\s*=\s*\[/i);
    expect(combinedCode).not.toMatch(/const\s+endpoints\s*=\s*\{/i);
    expect(combinedCode).not.toMatch(/['"]invoice-agent['"]/);
    expect(combinedCode).not.toMatch(/['"]contract-agent['"]/);
    expect(combinedCode).not.toMatch(/['"]brand-agent['"]/);
  });

  // TEST 9 — No real credentials tracked in repository files
  it('Test 9: Repository files MUST NOT contain real API keys, private keys, or credentials', () => {
    const projectRoot = path.resolve(__dirname, '..');

    const scanDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip ignored directories
        if (
          entry.isDirectory() &&
          ['node_modules', 'dist', '.git', 'coverage', '.vitest'].includes(entry.name)
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Skip local .env files (guaranteed un-tracked by .gitignore)
          if (entry.name === '.env' || entry.name === '.env.local') {
            continue;
          }

          const content = fs.readFileSync(fullPath, 'utf-8');

          // Check for real OpenAI secret key format (sk- followed by 20+ alphanumeric chars)
          expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);

          // Check for real 64-character Ethereum private keys (excluding example/test zero hashes)
          const privateKeyMatch = content.match(/0x[a-fA-F0-9]{64}/g);
          if (privateKeyMatch) {
            for (const pk of privateKeyMatch) {
              // Ensure it's not the null bytes hash namehash/zero hash
              const isZeroHash = pk === '0x0000000000000000000000000000000000000000000000000000000000000000';
              expect(isZeroHash).toBe(true);
            }
          }
        }
      }
    };

    scanDirectory(projectRoot);
  });
});
