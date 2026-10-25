import { spawnSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
const supported = version => { const [major,minor] = version.replace(/^v/,'').split('.').map(Number); return major >= 24 || (major === 22 && minor >= 18) }
let executable = process.execPath
if (!supported(process.version)) {
 const bundled=join(process.env.USERPROFILE || process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin',process.platform==='win32'?'node.exe':'node')
 const candidate=existsSync(bundled) ? spawnSync(bundled,['--version'],{encoding:'utf8',windowsHide:true}) : null
 if(!candidate || candidate.status!==0 || !supported(candidate.stdout.trim())) { console.error('SwingLab requires Node 22.18+ or Node 24. Install a supported Node version and retry.');process.exit(1) }
 executable=bundled
}
const jobs={dev:['node_modules/nuxt/bin/nuxt.mjs','dev','--host','127.0.0.1'],build:['node_modules/nuxt/bin/nuxt.mjs','build'],typecheck:['node_modules/nuxt/bin/nuxt.mjs','typecheck'],test:['node_modules/tsx/dist/cli.mjs','--test','tests/*.test.ts'],backtest:['node_modules/tsx/dist/cli.mjs','analytics/run-backtest.ts'],preview:['--env-file=.env','.output/server/index.mjs']}
const args=jobs[process.argv[2]]
if(!args)throw new Error('Unknown task')
const env={...process.env,PATH:dirname(executable)+(process.platform==='win32'?';':':')+process.env.PATH}
if(process.argv[2]==='preview')env.HOST='127.0.0.1'
const child=spawn(executable,[...args,...process.argv.slice(3)],{stdio:'inherit',env,windowsHide:true})
child.on('exit',code=>process.exit(code ?? 1))
child.on('error',()=>{console.error('Unable to launch task');process.exit(1)})
