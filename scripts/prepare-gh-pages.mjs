import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');

const expoPathRegex = /(["'(])\/_expo\//g;
const faviconRegex = /href="[^"]*favicon\.ico"/g;

function walk(dir) {
  const entries = readdirSync(dir);
  let files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files = files.concat(walk(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

for (const filePath of walk(distDir)) {
  if (!filePath.endsWith('.html') && !filePath.endsWith('.js')) {
    continue;
  }

  let content = readFileSync(filePath, 'utf-8');

  const original = content;
  content = content.replace(expoPathRegex, '$1./_expo/');
  content = content.replace(faviconRegex, 'href="./favicon.ico"');

  writeFileSync(filePath, content, 'utf-8');

  if (content !== original) {
    console.log(`Updated paths in ${filePath}`);
  }
}

const indexPath = join(distDir, 'index.html');
const notFoundPath = join(distDir, '404.html');
writeFileSync(notFoundPath, readFileSync(indexPath, 'utf-8'), 'utf-8');

console.log('GitHub Pages paths prepared in dist/');
