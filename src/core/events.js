// Tiny app-wide event bus.

const target = new EventTarget()

export function emit(type, detail = {}) {
  target.dispatchEvent(new CustomEvent(type, { detail }))
}

export function on(type, handler) {
  const wrapped = e => handler(e.detail, e)
  target.addEventListener(type, wrapped)
  return () => target.removeEventListener(type, wrapped)
}
