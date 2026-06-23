import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { strToU8, zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1');
const distDir = join(root, 'dist');
const releaseDir = join(root, 'release');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

async function collect(directory, files = {}) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(absolute, files);
    } else {
      const archivePath = relative(distDir, absolute).replaceAll('\\', '/');
      files[archivePath] = new Uint8Array(await readFile(absolute));
    }
  }
  return files;
}

await mkdir(releaseDir, { recursive: true });
const files = await collect(distDir);
files['BUILD_INFO.txt'] = strToU8(
  `Paper Translator ${packageJson.version}\nBuilt at ${new Date().toISOString()}\n`,
);
const output = join(releaseDir, `paper-translator-v${packageJson.version}.zip`);
await writeFile(output, zipSync(files, { level: 9 }));
console.log(`Created ${output}`);
