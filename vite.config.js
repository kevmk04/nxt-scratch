import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile, execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findNbcCompiler() {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'nbc.exe' : 'nbc';

  // 1. Check local ./tools folder relative to vite.config.js
  const toolByDirname = path.resolve(__dirname, 'tools', binaryName);
  if (fs.existsSync(toolByDirname)) {
    return toolByDirname;
  }

  // 2. Check local ./tools folder in current working directory
  const localTool = path.resolve(process.cwd(), 'tools', binaryName);
  if (fs.existsSync(localTool)) {
    return localTool;
  }

  // 3. Check standard Windows BricxCC install paths
  if (isWin) {
    const bricx1 = 'C:\\Program Files (x86)\\BricxCC\\nbc.exe';
    const bricx2 = 'C:\\Program Files\\BricxCC\\nbc.exe';
    if (fs.existsSync(bricx1)) return bricx1;
    if (fs.existsSync(bricx2)) return bricx2;
  }

  // 4. Check system PATH
  try {
    const cmd = isWin ? `where.exe ${binaryName}` : `which ${binaryName}`;
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstMatch = out.split(/\r?\n/)[0];
    if (firstMatch && fs.existsSync(firstMatch)) {
      return firstMatch;
    }
  } catch (e) {
    // Not on PATH
  }

  return null;
}

function createCompilerMiddleware() {
  return (req, res, next) => {
    const rawUrl = req.url || '';
    const url = rawUrl.split('?')[0];
    const isCompileEndpoint = url === '/api/compile-nxc' || url.endsWith('/api/compile-nxc');
    const isStatusEndpoint = url === '/api/compiler-status' || url.endsWith('/api/compiler-status');

    // CORS preflight
    if (req.method === 'OPTIONS' && (isCompileEndpoint || isStatusEndpoint)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.statusCode = 204;
      res.end();
      return;
    }

    // Status check endpoint
    if (isStatusEndpoint && req.method === 'GET') {
      const compilerPath = findNbcCompiler();
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        available: !!compilerPath,
        path: compilerPath || null
      }));
      return;
    }

    // Compilation endpoint
    if (isCompileEndpoint && req.method === 'POST') {
      res.setHeader('Access-Control-Allow-Origin', '*');

      const handlePayload = (payload) => {
        let data = payload;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            return;
          }
        }

        if (!data || typeof data !== 'object') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Payload must be an object' }));
          return;
        }

        const { nxcCode, filename = 'program.rxe' } = data;
        if (!nxcCode) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'nxcCode is required' }));
          return;
        }

        const compilerPath = findNbcCompiler();
        if (!compilerPath) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            notFound: true,
            error: 'NBC compiler (nbc.exe) was not found on system PATH or in ./tools/ directory.',
            nxcCode
          }));
          return;
        }

        // Create temporary scratch dir for compilation
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxt-compile-'));
        const nxcFile = path.join(tmpDir, 'source.nxc');
        const rxeFile = path.join(tmpDir, filename.endsWith('.rxe') ? filename : `${filename}.rxe`);

        try {
          fs.writeFileSync(nxcFile, nxcCode, 'utf-8');

          execFile(compilerPath, [nxcFile, `-O=${rxeFile}`], { timeout: 15000 }, (err, stdout, stderr) => {
            try {
              // Locate output binary: NBC may output with .rxe or without extension
              let actualOutput = null;
              if (fs.existsSync(rxeFile)) {
                actualOutput = rxeFile;
              } else if (fs.existsSync(rxeFile.replace(/\.rxe$/i, ''))) {
                actualOutput = rxeFile.replace(/\.rxe$/i, '');
              } else {
                const candidates = fs.readdirSync(tmpDir).filter(f => !f.endsWith('.nxc'));
                if (candidates.length > 0) {
                  actualOutput = path.join(tmpDir, candidates[0]);
                }
              }

              if (err || !actualOutput || !fs.existsSync(actualOutput)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  error: stderr || stdout || (err ? err.message : 'Compilation produced no binary'),
                  log: `${stdout}\n${stderr}`.trim(),
                  nxcCode
                }));
              } else {
                const rxeBuffer = fs.readFileSync(actualOutput);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  filename: path.basename(rxeFile),
                  rxeBase64: rxeBuffer.toString('base64'),
                  size: rxeBuffer.length,
                  log: `${stdout}\n${stderr}`.trim()
                }));
              }
            } finally {
              try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
              } catch (e) {}
            }
          });
        } catch (writeErr) {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch (e) {}
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: writeErr.message }));
        }
      };

      if (req.body) {
        handlePayload(req.body);
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        handlePayload(body);
      });
      return;
    }

    next();
  };
}

function nbcCompilerPlugin() {
  const middleware = createCompilerMiddleware();
  return {
    name: 'nbc-compiler-plugin',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig({
  plugins: [nbcCompilerPlugin()]
});
