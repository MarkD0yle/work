#!/usr/bin/env node
/**
 * Build Harbor for static hosting under one host.
 *
 * In development every app has its own localhost port (its own origin). A
 * static host has one origin, so here each app is built under a path instead:
 * /harbor/shell/, /harbor/fx-exec/ and so on. The shell's directory is rewritten
 * to relative URLs with the origin "self", which the shell resolves at runtime.
 *
 * Usage: node scripts/build-hosted.mjs <outDir> [basePath]
 *   outDir    where to write the builds, e.g. ../dist/harbor
 *   basePath  URL path the builds are served from (default /harbor/)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(process.argv[2] ?? join(root, 'dist-hosted'))
const base = (process.argv[3] ?? '/harbor/').replace(/\/?$/, '/')

// Dev port of each app, read from its vite config. Placeholder runs on two.
const portToApp = { 5174: 'placeholder', 5181: 'placeholder' }
const apps = readdirSync(join(root, 'apps')).filter((a) => existsSync(join(root, 'apps', a, 'vite.config.ts')))
for (const app of apps) {
  const port = readFileSync(join(root, 'apps', app, 'vite.config.ts'), 'utf8').match(/port:\s*(\d+)/)?.[1]
  if (port) portToApp[port] = app
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const vite = join(root, 'node_modules', '.bin', 'vite')
for (const app of apps) {
  console.log(`==> Harbor: building ${app} at ${base}${app}/`)
  execFileSync(vite, ['build', '--base', `${base}${app}/`, '--outDir', join(outDir, app), '--emptyOutDir'], {
    cwd: join(root, 'apps', app),
    stdio: 'inherit',
  })
}

// Rewrite the shell's directory for the hosted layout.
const directory = JSON.parse(readFileSync(join(root, 'apps', 'shell', 'public', 'directory.json'), 'utf8'))
for (const record of directory.applications) {
  if (record.kind !== 'app') continue
  const url = new URL(record.details.url)
  const app = portToApp[url.port]
  if (!app) throw new Error(`No app is served on port ${url.port} (${record.appId})`)
  record.details.url = `${base}${app}/${url.search}`
  record.allowedOrigins = ['self']
}
writeFileSync(join(outDir, 'shell', 'directory.json'), JSON.stringify(directory, null, 2) + '\n')
console.log(`==> Harbor: hosted build written to ${outDir}`)
