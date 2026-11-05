import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'terser';

const path = 'src/assets/yii2-dynamic-form';
const result = await minify(await readFile(`${path}.js`, 'utf8'), {
  format: { comments: /@author/ },
});
await writeFile(`${path}.min.js`, `${result.code}\n`);
