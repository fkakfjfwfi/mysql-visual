// 把 dist 发布到 GitHub Pages（gh-pages 分支）。
// 用法：npm run deploy
// 若本机 git 访问 github.com 需要代理，先在本仓库里配一次：
//   git config --local http.https://github.com.proxy http://127.0.0.1:7897
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REMOTE = 'https://github.com/fkakfjfwfi/mysql-visual.git'
const staging = join(process.cwd(), '.deploy-gh-pages')

function run(cmd, cwd = process.cwd()) {
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function tryConfig(key) {
  try {
    return execSync(`git config --get ${key}`, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

console.log('1/4 构建')
run('npm run build')

console.log('2/4 准备发布目录')
rmSync(staging, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
cpSync('dist', staging, { recursive: true })
writeFileSync(join(staging, '.nojekyll'), '') // 关掉 Jekyll，保证 _ 开头的文件也能发布

console.log('3/4 提交')
run('git init -q -b gh-pages', staging)
run('git add -A', staging)
run(
  `git -c user.name="deploy" -c user.email="deploy@local" commit -q -m "deploy: ${new Date().toISOString()}"`,
  staging,
)

console.log('4/4 推送')
// 优先用环境变量里的代理，其次沿用本仓库为该域名配的代理
const proxy = process.env.GIT_PROXY || tryConfig('http.https://github.com.proxy')
run(`git${proxy ? ` -c http.https://github.com.proxy=${proxy}` : ''} push -f ${REMOTE} gh-pages`, staging)

rmSync(staging, { recursive: true, force: true })
console.log('完成：https://fkakfjfwfi.github.io/mysql-visual/')
