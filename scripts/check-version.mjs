import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(
  readFileSync('package.json', 'utf8')
)

const lock = JSON.parse(
  readFileSync('package-lock.json', 'utf8')
)

const tauri = JSON.parse(
  readFileSync('src-tauri/tauri.conf.json', 'utf8')
)

const cargo = readFileSync(
  'src-tauri/Cargo.toml',
  'utf8'
)

const cargoVersion = cargo.match(
  /^version\s*=\s*"([^"]+)"/m
)?.[1]

const version = pkg.version

assert.match(version, /^\d+\.\d+\.\d+$/)

assert.equal(tauri.version, version, 'Tauri version mismatch')
assert.equal(cargoVersion, version, 'Cargo version mismatch')
assert.equal(lock.version, version, 'NPM lock version mismatch')
assert.equal(lock.packages[''].version, version)

if (process.env.RELEASE_TAG) {
  assert.equal(
    process.env.RELEASE_TAG,
    `v${version}`,
    'Release tag does not match application version'
  )
}

console.log(`MikosChat version verified: ${version}`)