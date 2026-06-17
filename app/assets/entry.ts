import { run } from 'remix/ui'

run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  // Required for client-side navigation: the runtime intercepts in-app anchor
  // clicks and reloads the top frame, fetching the destination route's HTML so
  // its body, head/title, and server-rendered styles are reconciled in. Without
  // this, navigations render the new route unstyled.
  async resolveFrame(src, signal, target) {
    let headers = new Headers({ accept: 'text/html' })
    if (target) headers.set('x-remix-target', target)
    let response = await fetch(src, { headers, signal })
    return response.body ?? (await response.text())
  },
})
