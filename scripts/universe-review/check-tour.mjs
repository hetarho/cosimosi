import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [modulePath, executablePath, outputDirectory] = process.argv.slice(2)
if (!modulePath || !outputDirectory)
  throw new Error(
    'Usage: node check-tour.mjs <playwright module> <chrome executable> <output directory>',
  )
const { chromium } = await import(pathToFileURL(modulePath).href)
await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true })
const results = []
try {
  for (const [name, viewport, reducedMotion] of [
    ['compact', { width: 768, height: 663 }, 'no-preference'],
    ['phone', { width: 390, height: 844 }, 'reduce'],
    ['desktop', { width: 1024, height: 768 }, 'no-preference'],
    ['comparison', { width: 1800, height: 1100 }, 'no-preference'],
  ]) {
    const selectedCases = process.argv
      .find((argument) => argument.startsWith('--cases='))
      ?.slice('--cases='.length)
      .split(',')
    if (selectedCases && !selectedCases.includes(name)) continue
    const page = await browser.newPage({ viewport, reducedMotion, locale: 'en-US' })
    page.setDefaultTimeout(20000)
    const errors = []
    const clearanceChecks = []
    const readabilityChecks = []
    let colourDwellMs = null
    let recallVisual = null
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' && /WebGPU|shader|WGSL|THREE|validation/i.test(message.text()))
        errors.push(message.text())
    })
    const fixtureDraw = name === 'compact' ? 0.84 : name === 'phone' ? 0.5 : 0.25
    await page.addInitScript((draw) => {
      const original = Math.random
      Math.random = () =>
        /\/demo-route-/.test(new Error().stack?.split('\n')[2] ?? '') ? draw : original()
      localStorage.setItem('cosimosi.locale', 'en')
    }, fixtureDraw)
    const scope = name === 'comparison' ? page.frameLocator('#after') : page
    const button = (anchor) => scope.locator(`[data-sequence-anchor="${anchor}"] button`).first()
    const press = async (anchor) => {
      const target = button(anchor)
      await target.waitFor({ state: 'visible' })
      await page.waitForTimeout(250)
      const clipped = await target.evaluate((node) => {
        const win = node.ownerDocument.defaultView
        const box = node.getBoundingClientRect()
        let top = Math.max(0, box.top)
        let bottom = Math.min(win.innerHeight, box.bottom)
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          if (!/(auto|scroll|hidden)/.test(win.getComputedStyle(parent).overflowY)) continue
          const clip = parent.getBoundingClientRect()
          top = Math.max(top, clip.top)
          bottom = Math.min(bottom, clip.bottom)
        }
        return box.height - (bottom - top) > 1
      })
      if (clipped) {
        await page.screenshot({ path: path.join(outputDirectory, `${name}-clipped-${anchor}.png`) })
        throw new Error(`${name}: ${anchor} is clipped before clicking`)
      }
      await target.click()
    }
    const automaticTarget = async (anchor) => {
      const target = button(anchor)
      await target.waitFor({ state: 'visible' })
      return target.evaluate(async (node) => {
        let scroller = node.parentElement
        const panel = node.closest('[data-cosimosi-surface]')
        while (
          scroller &&
          scroller !== panel &&
          !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
        )
          scroller = scroller.parentElement
        const started = performance.now()
        let last = Number.NaN,
          settled = 0
        for (;;) {
          await new Promise(requestAnimationFrame)
          const box = node.getBoundingClientRect()
          const clip = scroller.getBoundingClientRect()
          settled = Math.abs(box.top - last) < 0.5 ? settled + 1 : 0
          last = box.top
          if (box.top >= clip.top && box.bottom <= clip.bottom && settled >= 3)
            return { scrollTop: scroller.scrollTop, label: node.textContent.trim() }
          if (performance.now() - started > 5000)
            throw new Error('Guided target did not scroll into the panel')
        }
      })
    }
    const step = async (number) => {
      await scope.getByText(`${number} of 10`, { exact: true }).waitFor()
      console.log(`${name}: step ${number}`)
    }
    // The band, not the live region: the region is a zero-size root that is never visible, and the
    // band carries the caption's place and visibility.
    const caption = (text) =>
      scope.locator('[data-sequence-caption-band]').filter({ hasText: text }).waitFor()
    const shot = async (label, delay = 350) => {
      await page.waitForTimeout(delay)
      return page.screenshot({ path: path.join(outputDirectory, `${name}-${label}.png`) })
    }
    const clearCaption = async (label) => {
      const paragraph = scope.locator('[data-sequence-caption-band] p')
      await paragraph.waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
      const result = await paragraph.evaluate((node) => {
        const doc = node.ownerDocument
        const win = doc.defaultView
        const caption = node.getBoundingClientRect()
        const modal = [...doc.querySelectorAll('[aria-modal="true"]')].at(-1)
        const overlaps = []
        for (const control of (modal ?? doc).querySelectorAll(
          'button, a[href], input, textarea, select, [contenteditable="true"], [role="button"], [role="slider"]',
        )) {
          if (control.closest('[data-sequence-chrome]')) continue
          const style = win.getComputedStyle(control)
          if (style.visibility === 'hidden' || style.display === 'none') continue
          const box = control.getBoundingClientRect()
          if (!box.width || !box.height) continue
          let top = Math.max(0, box.top)
          let bottom = Math.min(win.innerHeight, box.bottom)
          for (let parent = control.parentElement; parent; parent = parent.parentElement) {
            if (!/(auto|scroll|hidden)/.test(win.getComputedStyle(parent).overflowY)) continue
            const clip = parent.getBoundingClientRect()
            top = Math.max(top, clip.top)
            bottom = Math.min(bottom, clip.bottom)
          }
          if (
            bottom > top &&
            Math.min(caption.right, box.right) > Math.max(caption.left, box.left) &&
            Math.min(caption.bottom, bottom) > Math.max(caption.top, top)
          )
            overlaps.push(
              control.getAttribute('aria-label') ?? control.textContent?.trim() ?? control.tagName,
            )
        }
        return {
          overlaps,
          onscreen:
            caption.top >= 0 &&
            caption.bottom <= win.innerHeight &&
            caption.left >= 0 &&
            caption.right <= win.innerWidth,
          visible: win.getComputedStyle(node).visibility === 'visible',
        }
      })
      if (!result.onscreen || !result.visible || result.overlaps.length)
        throw new Error(`${name} ${label}: caption clearance failed ${JSON.stringify(result)}`)
      clearanceChecks.push(label)
    }
    const readable = async (label, selector, expectWordLoss = false) => {
      const target = scope.locator(selector).first()
      await target.waitFor({ state: 'visible' })
      await page.waitForTimeout(350)
      const result = await target.evaluate((node) => {
        const doc = node.ownerDocument
        const win = doc.defaultView
        const panel = node.closest('[aria-modal="true"]')
        const box = node.getBoundingClientRect()
        const body = panel?.querySelector('.overflow-y-auto')?.getBoundingClientRect()
        const effects = []
        for (let parent = node; parent; parent = parent.parentElement) {
          const style = win.getComputedStyle(parent)
          if (style.filter !== 'none') effects.push(parent.tagName)
        }
        const mask = doc.querySelector('[data-demo-tutorial-mask]')
        const lost = node.querySelectorAll('.obscured-run')
        return {
          effects,
          maskOpacity: mask ? Number(win.getComputedStyle(mask).opacity) : 0,
          visibleInBody: !body || (box.top >= body.top - 1 && box.bottom <= body.bottom + 1),
          lost: lost.length,
          selectivelyBlurred: [...lost].every(
            (word) => win.getComputedStyle(word).filter !== 'none',
          ),
          clear: [...node.querySelectorAll('p > span:not(.obscured-run)')].some(
            (word) => word.textContent.trim() && win.getComputedStyle(word).filter === 'none',
          ),
        }
      })
      if (
        result.effects.length ||
        result.maskOpacity > 0.02 ||
        !result.visibleInBody ||
        (expectWordLoss && (!result.lost || !result.clear || !result.selectivelyBlurred))
      )
        throw new Error(`${name} ${label}: readability failed ${JSON.stringify(result)}`)
      readabilityChecks.push({ label, ...result })
    }
    await page.goto(
      name === 'comparison'
        ? 'http://localhost:1214/review'
        : 'http://localhost:1214/__review/to-be/demo',
      { waitUntil: 'domcontentloaded' },
    )
    await step(1)
    await clearCaption('read-entry')
    await press('diary-read-action')
    await step(2)
    await clearCaption('first-split')
    await shot('split-guide')
    await press('split-action')
    await step(3)
    await clearCaption('first-launch')
    await readable('proposal', '[aria-modal="true"] ul > li')
    await shot('proposal-readable')
    await press('launch-action')
    await step(4)
    await caption('Write one more entry')
    await clearCaption('second-write')
    await press('write-action')
    await button('split-action').waitFor({ state: 'visible' })
    await clearCaption('second-draft')
    await shot('second-draft')
    await press('split-action')
    await button('launch-action').waitFor({ state: 'visible' })
    await clearCaption('second-proposal')
    await press('launch-action')
    await step(5)
    await caption('Now let a month pass')
    await clearCaption('first-month')
    await press('time-month-action')
    await step(6)
    await caption('Look at the words that have faded')
    await clearCaption('recall')
    await readable('word-loss', '[data-demo-memory-words]', true)
    await shot('recall-word-loss')
    await press('recall-action')
    await button('recall-confirm-action').waitFor({ state: 'visible' })
    await clearCaption('recall-confirm')
    if (name === 'desktop')
      await scope
        .locator('canvas')
        .first()
        .evaluate((canvas) => {
          const win = canvas.ownerDocument.defaultView
          if (!canvas.captureStream || !win.MediaRecorder) return
          const stream = canvas.captureStream(30)
          const chunks = []
          const recorder = new win.MediaRecorder(stream, { mimeType: 'video/webm' })
          recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data)
          }
          win.__recallRecording = { recorder, chunks, stream }
          recorder.start()
        })
    await press('recall-confirm-action')
    await scope.locator('[data-demo-recall-phase="focus"]').waitFor()
    await scope.locator('[data-demo-recall-phase="feedback"]').waitFor()
    if (await scope.locator('[aria-modal="true"]').count())
      throw new Error(`${name}: recall changed while the modal still covered it`)
    await shot('recall-effect', reducedMotion === 'reduce' ? 0 : 150)
    await button('recall-dismiss-action').waitFor({ state: 'visible' })
    if (name === 'desktop') {
      const data = await scope
        .locator('canvas')
        .first()
        .evaluate(async (canvas) => {
          const win = canvas.ownerDocument.defaultView
          const recording = win.__recallRecording
          if (!recording) return null
          return new Promise((resolve) => {
            recording.recorder.onstop = () => {
              const reader = new win.FileReader()
              reader.onload = () => resolve(reader.result)
              reader.readAsDataURL(new win.Blob(recording.chunks, { type: 'video/webm' }))
              recording.stream.getTracks().forEach((track) => track.stop())
            }
            recording.recorder.stop()
          })
        })
      if (data)
        await writeFile(
          path.join(outputDirectory, 'desktop-recall.webm'),
          Buffer.from(data.split(',')[1], 'base64'),
        )
    }
    await clearCaption('recall-result')
    const comparison = scope.locator('[data-demo-recall-comparison]')
    await comparison.waitFor({ state: 'visible' })
    const percentages = await comparison.locator('span.tabular-nums').allTextContents()
    recallVisual = {
      before: Number.parseInt(percentages[0], 10),
      after: Number.parseInt(percentages[1], 10),
    }
    if (!(recallVisual.before < recallVisual.after && recallVisual.after === 100))
      throw new Error(
        `${name}: recall did not become visibly brighter ${JSON.stringify(recallVisual)}`,
      )
    await readable('recall-result', '[data-demo-recall-comparison]')
    await shot('recall-comparison')
    await press('recall-dismiss-action')
    await step(7)
    await caption('Let more time pass')
    await clearCaption('second-month')
    await press('time-month-action')
    await step(8)
    await caption('Your memories colour')
    await scope.locator('[data-sequence-caption-band] p').waitFor({ state: 'visible' })
    const colourStarted = Date.now()
    await clearCaption('sky')
    await shot('gist-overview')
    await step(9)
    colourDwellMs = Date.now() - colourStarted
    await clearCaption('decorate-open')
    await shot('decoration-entry')
    const entryDim = await scope.locator('[data-demo-tutorial-mask]').evaluate((node) => {
      const style = getComputedStyle(node)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = style.backgroundColor
      ctx.fillRect(0, 0, 1, 1)
      return (Number(style.opacity) * ctx.getImageData(0, 0, 1, 1).data[3]) / 255
    })
    if (entryDim < 0.6) throw new Error(`${name}: decoration entry has no useful dimming`)
    await press('decorate-action')
    await scope.getByRole('heading', { name: 'Decorate your universe' }).waitFor()
    await clearCaption('decorate-choice')
    const skipBox = await scope.getByRole('button', { name: 'Skip', exact: true }).boundingBox()
    const close = scope.getByRole('button', { name: 'Close', exact: true })
    const closeBox = await close.boundingBox()
    if (!skipBox || !closeBox || intersects(skipBox, closeBox))
      throw new Error(`${name}: skip overlaps the panel close`)
    if (await scope.getByRole('button', { name: 'Grainient', exact: true }).isEnabled())
      throw new Error(`${name}: unchanged default is still suggested`)
    const skyExample = await automaticTarget('ornament-row-action')
    await press('ornament-row-action')
    await scope.locator('[data-demo-decoration-stage="sky-preview"]').waitFor()
    const previewStarted = Date.now()
    await clearCaption('decorate-sky-preview')
    await shot('decoration-sky-preview', 100)
    await scope.locator('[data-demo-decoration-stage="shape"]').waitFor()
    const skyPreviewMs = Date.now() - previewStarted
    if (skyPreviewMs < 750) throw new Error(`${name}: sky preview was skipped (${skyPreviewMs}ms)`)
    const shapeExample = await automaticTarget('ornament-shape-action')
    if (shapeExample.scrollTop <= 0)
      throw new Error(`${name}: shape group was not automatically scrolled`)
    if (await button('decorate-close-action').isEnabled())
      throw new Error(`${name}: return enabled before changing a shape`)
    await clearCaption('decorate-shape')
    await shot('decoration-shape')
    await press('ornament-shape-action')
    await caption('The new sky and star shape are applied')
    await clearCaption('decorate-return')
    const done = button('decorate-close-action')
    if (!(await done.isEnabled())) throw new Error(`${name}: selection did not enable return`)
    await shot('decoration-selected')
    const captionBox = await scope.locator('[data-sequence-caption-band] p').boundingBox()
    const panelBox = await scope.locator('[data-cosimosi-surface]').boundingBox()
    if (!captionBox || !panelBox || intersects(captionBox, panelBox))
      throw new Error(`${name}: caption overlaps the decoration panel`)
    if (name !== 'phone') {
      const writeBox = await button('write-action').boundingBox()
      if (writeBox && intersects(captionBox, writeBox))
        throw new Error(`${name}: caption overlaps the write action`)
    }
    await done.click()
    await step(10)
    await clearCaption('exit')
    await scope.getByRole('button', { name: 'Skip', exact: true }).waitFor({ state: 'detached' })
    if (!(await button('time-month-action').isEnabled()))
      throw new Error(`${name}: free play is still gated`)
    await shot('completed')
    if (name === 'comparison')
      await page
        .frameLocator('#before')
        .getByRole('button', { name: 'Skip', exact: true })
        .waitFor({ state: 'detached' })
    if (name === 'desktop' && !process.argv.includes('--skip-catalogue')) {
      await press('decorate-action')
      const skyNames = [
        'Grainient',
        'Grainstorm',
        'Iridescence',
        'Soft Aurora',
        'Liquid Ether',
        'Prismatic Burst',
        'Plasma Wave',
        'Ferrofluid',
        'Floating Lines',
        'Evil Eye',
        'Lightfall',
        'Pixel Blast',
      ]
      for (const label of skyNames) {
        await scope.getByRole('button', { name: new RegExp(`^${label}( Now)?$`) }).click()
        await page.waitForTimeout(200)
      }
      const groups = scope.locator('[data-cosimosi-surface] section[aria-label]')
      let selections = skyNames.length
      for (let group = 1; group < (await groups.count()); group++) {
        const rows = groups.nth(group).getByRole('button')
        for (let row = 0; row < (await rows.count()); row++) {
          await rows.nth(row).click()
          await page.waitForTimeout(200)
          selections++
        }
      }
      console.log(`${name}: ${selections} catalogue selections across every group`)
      await press('decorate-close-action')
      await shot('catalogue-return')
      console.log(`${name}: all ${skyNames.length} sky styles selected without leaving free play`)
    }
    const graphics = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter()
      return {
        webgpu: !!adapter,
        fallback: adapter?.isFallbackAdapter ?? false,
        description: adapter?.info?.description ?? '',
      }
    })
    if (errors.length) throw new Error(`${name}: renderer errors\n${errors.join('\n')}`)
    results.push({
      name,
      viewport,
      reducedMotion,
      graphics,
      steps: 10,
      outcome: 'completed',
      clearanceChecks,
      readabilityChecks,
      colourDwellMs,
      fixtureDraw,
      recallVisual,
      decoration: { entryDim, skyExample, shapeExample, skyPreviewMs },
      errors,
    })
    await page.close()
  }
  await writeFile(
    path.join(outputDirectory, 'tour-results.json'),
    JSON.stringify({ browser: browser.version(), results }, null, 2),
  )
  console.log(`PASS: all complete real tours. Evidence: ${outputDirectory}`)
} finally {
  await browser.close()
}

function intersects(a, b) {
  return (
    Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)
  )
}
