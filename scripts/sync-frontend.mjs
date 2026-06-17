import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const target = join(root, 'server', 'public')

if (!existsSync(dist)) {
  console.error('dist/ not found — run "npm run build" first')
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
cpSync(dist, target, { recursive: true })
console.log('Synced dist/ → server/public/')
