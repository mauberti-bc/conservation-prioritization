import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('streams assets, serves HEAD and SPA fallback, and survives aborted downloads', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'frontend-stream-'));
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  let child;
  try {
    await mkdir(path.join(directory, 'server'));
    await mkdir(path.join(directory, 'build'));
    for (const filename of ['index.mjs', 'constants.mjs']) {
      await copyFile(new URL(filename, import.meta.url), path.join(directory, 'server', filename));
    }
    const asset = Buffer.alloc(8 * 1024 * 1024, 65);
    await writeFile(path.join(directory, 'build', 'asset.js'), asset);
    await writeFile(path.join(directory, 'build', 'index.html'), '<html>Map</html>');
    child = spawn(process.execPath, [path.join(directory, 'server', 'index.mjs')], {
      env: { ...process.env, APP_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await once(child.stdout, 'data');
    const url = `http://127.0.0.1:${port}`;
    const response = await fetch(`${url}/asset.js`);
    assert.equal(response.status, 200);
    assert.equal(Number(response.headers.get('content-length')), asset.length);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), asset);
    const head = await fetch(`${url}/asset.js`, { method: 'HEAD' });
    assert.equal(Number(head.headers.get('content-length')), asset.length);
    assert.equal(await head.text(), '');
    const fallback = await fetch(`${url}/map/task-1`);
    assert.equal(await fallback.text(), '<html>Map</html>');
    const aborted = await fetch(`${url}/asset.js`);
    await aborted.body.cancel();
    const health = await fetch(`${url}/health`);
    assert.deepEqual(await health.json(), { success: true });
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
