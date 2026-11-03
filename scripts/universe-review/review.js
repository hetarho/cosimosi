const frames = [...document.querySelectorAll('iframe')]
const sync = document.querySelector('#sync')
const status = document.querySelector('#status')
let viewport = 'desktop'
let generation = 0

function resize() {
  for (const frame of frames) {
    const stage = frame.closest('.stage')
    const width = viewport === 'mobile' ? 390 : 1024
    const height =
      viewport === 'mobile'
        ? 844
        : Math.round((stage.clientHeight * width) / Math.max(1, stage.clientWidth))
    frame.parentElement.style.width = `${width}px`
    frame.parentElement.style.height = `${height}px`
    frame.parentElement.style.transform = `scale(${Math.min(stage.clientWidth / width, stage.clientHeight / height)})`
  }
}
const stageResize = new ResizeObserver(resize)
document.querySelectorAll('.stage').forEach((stage) => stageResize.observe(stage))
window.addEventListener('resize', resize)
document.querySelectorAll('[data-viewport]').forEach((button) => {
  button.addEventListener('click', () => {
    viewport = button.dataset.viewport
    document
      .querySelectorAll('[data-viewport]')
      .forEach((item) => item.setAttribute('aria-pressed', String(item === button)))
    resize()
  })
})
document.querySelectorAll('[data-expand]').forEach((button) => {
  button.addEventListener('click', () => {
    document
      .querySelector(`#${button.dataset.expand}`)
      .closest('.version')
      .classList.toggle('expanded')
    resize()
  })
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelectorAll('.expanded').forEach((panel) => panel.classList.remove('expanded'))
    resize()
  }
})
document.querySelector('#findings-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget
  const panel = document.querySelector('#findings')
  panel.hidden = !panel.hidden
  button.setAttribute('aria-expanded', String(!panel.hidden))
  resize()
})
document.querySelector('#restart').addEventListener('click', () => {
  generation++
  frames[0].src = '/__review/as-is/demo'
  frames[1].src = '/__review/to-be/demo'
  status.textContent = '같은 일기로 다시 시작합니다'
})
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.channel !== 'universe-review') return
  const source = frames.find((frame) => frame.contentWindow === event.source)
  if (!source) return
  const message = event.data
  if (message.type === 'step') {
    document.querySelector(`[data-for="${source.id}"]`).textContent =
      message.text || '장면을 보여주는 중'
  } else if (message.type === 'action' && sync.checked) {
    const target = frames.find((frame) => frame !== source)
    target.contentWindow.postMessage({ ...message, type: 'replay', generation }, location.origin)
    status.textContent = '같은 동작을 전달했습니다'
  } else if (message.type === 'waiting') {
    status.textContent = '다른 쪽의 장면이 끝나기를 기다립니다'
  } else if (message.type === 'replayed') {
    status.textContent = '양쪽에서 같은 동작을 보고 있습니다'
  } else if (message.type === 'missed') {
    status.textContent = '진행이 달라졌습니다. 양쪽 처음부터로 다시 비교할 수 있습니다'
  }
})
resize()
