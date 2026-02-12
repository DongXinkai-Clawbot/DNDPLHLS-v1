# Environment Pinning

Pinned runtime:
- Node: `.nvmrc` = 20
- package.json engines:
  - node: `>=20 <21`
  - npm: `>=10 <11`

Local setup:
1) `nvm use` (or `fnm use`)
2) `npm ci`
3) `npm run verify`
