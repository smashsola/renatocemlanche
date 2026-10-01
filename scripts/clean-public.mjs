import { readdir, readFile, writeFile, appendFile, rename } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
const root = new URL('../', import.meta.url);
async function clean(directory) {
 for (const entry of await readdir(directory, { withFileTypes: true })) {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) { await clean(path); continue; }
  if (entry.name.endsWith('.LEGAL.txt')) {
   await rename(path, new URL(entry.name.includes('metrics') ? 'LICENSES-chart.txt' : entry.name.includes('stepper') ? 'LICENSES-stepper.txt' : entry.name.includes('pix') ? 'LICENSES-pix.txt' : 'LICENSES-nav.txt', root));
   continue;
  }
  const extension = extname(path);
  if (!['.js', '.css', '.html', '.svg'].includes(extension)) continue;
  const source = await readFile(path, 'utf8');
  let output;
  if (extension === '.js') output = (await transform(source, { loader: 'js', target: 'esnext', legalComments: 'none', minifyWhitespace: true })).code;
  else {
   if (extension === '.css') {
    const licenses = source.match(/\/\*![\s\S]*?\*\//g) || [];
    for (const license of licenses) await appendFile(new URL('LICENSES-styles.txt', root), license.slice(2, -2) + '\n');
   }
   output = source.replace(extension === '.css' ? /\/\*[\s\S]*?\*\//g : /<!--[\s\S]*?-->/g, '');
  }
  await writeFile(path, output);
 }
}
await clean(fileURLToPath(new URL('../dist/', import.meta.url)));



