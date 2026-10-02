import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent('<style>body{margin:0}svg{width:100vw;height:100vh}</style>' + await readFile('docs/public/icon.svg', 'utf8'))
  await page.screenshot({ path: `docs/public/icon-${size}.png` })
  await page.close()
}
await browser.close()
