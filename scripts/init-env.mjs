import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
try {
  await access('.env');
  console.log('.env 已存在，未覆盖');
} catch {
  const password = randomBytes(24).toString('hex');
  const secret = randomBytes(48).toString('hex');
  const text = (await readFile('.env.example', 'utf8'))
    .replaceAll('replace-with-a-random-database-password', password)
    .replace('replace-with-a-random-secret-of-at-least-32-characters', secret);
  await writeFile('.env', text, { flag: 'wx', mode: 0o600 });
  console.log('已生成 .env（demo 模式），密钥未输出');
}
