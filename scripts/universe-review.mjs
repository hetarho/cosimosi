import { readFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const baseline = path.join(root, '.git/universe-review/as-is')
const candidate = path.join(root, '.git/universe-review/to-be')
const evidence = path.join(root, '.git/universe-review/qa-recall-final')
const fonts = path.join(root, 'node_modules/wanted-sans/fonts/webfonts/variable/split')
const review = path.resolve(fileURLToPath(new URL('./universe-review/', import.meta.url)))
const types = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webm': 'video/webm',
}

/** Local review tools never enter the production bundle or the account's data path. */
export function universeReview() {
  return {
    name: 'universe-review',
    apply: 'serve',
    transformIndexHtml(html, context) {
      if (!context.originalUrl?.includes('universe-review')) return html
      return html.replace('<head>', '<head><script src="/__review/bridge.js"></script>')
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const isBaseline = url.pathname.startsWith('/__review/as-is/')
        const isCandidate = url.pathname.startsWith('/__review/to-be/')
        const isFont = url.pathname.startsWith('/__review/fonts/')
        const isEvidence = url.pathname.startsWith('/__review/evidence/')
        const snapshotKind = isBaseline ? 'as-is' : isCandidate ? 'to-be' : null
        if (url.pathname !== '/review' && !url.pathname.startsWith('/__review/')) return next()
        try {
          let requested =
            url.pathname === '/review' ? 'index.html' : url.pathname.slice('/__review/'.length)
          const directory = isBaseline
            ? baseline
            : isCandidate
              ? candidate
              : isEvidence
                ? evidence
                : isFont
                  ? fonts
                  : review
          if (isFont) requested = requested.slice('fonts/'.length)
          if (isEvidence) requested = requested.slice('evidence/'.length)
          if (snapshotKind) requested = requested.slice(snapshotKind.length + 1)
          // The baseline is an SPA; only its assets are files addressed by their URL.
          if (snapshotKind && !requested.startsWith('assets/')) requested = 'index.html'
          const filename = path.resolve(directory, requested)
          if (!filename.startsWith(directory + path.sep)) {
            res.writeHead(403).end()
            return
          }
          const info = await stat(filename)
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Content-Type', types[path.extname(filename)] ?? 'application/octet-stream')
          if (path.extname(filename) === '.webm') {
            res.setHeader('Accept-Ranges', 'bytes')
            const range = req.headers.range
            if (range) {
              const match = /^bytes=(\d*)-(\d*)$/.exec(range)
              const start = match?.[1]
                ? Number(match[1])
                : Math.max(0, info.size - Number(match?.[2]))
              const end =
                match?.[1] && match[2] ? Math.min(info.size - 1, Number(match[2])) : info.size - 1
              if (!match || (!match[1] && !match[2]) || start > end || start >= info.size) {
                res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end()
                return
              }
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${info.size}`,
                'Content-Length': end - start + 1,
              })
              createReadStream(filename, { start, end }).pipe(res)
              return
            }
            res.setHeader('Content-Length', info.size)
          }
          if (snapshotKind && requested === 'index.html') {
            let html = await readFile(filename, 'utf8')
            html = html.replaceAll('"/assets/', `"/__review/${snapshotKind}/assets/`)
            html = html.replace(
              '<head>',
              `<head><script>history.replaceState(null,"","/demo?universe-review=${snapshotKind}")</script><script src="/__review/bridge.js"></script>`,
            )
            res.end(html)
          } else createReadStream(filename).pipe(res)
        } catch {
          res.writeHead(404).end('Review build missing. Run node scripts/preview-universe.mjs.')
        }
      })
    },
  }
}
