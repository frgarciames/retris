import type { Handle, RemixNode } from 'remix/ui'

import { css } from 'remix/ui'
import { routes } from '../routes.ts'

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
}

const DEFAULT_TITLE = readAppDisplayName('Retris')

const PLAUSIBLE_INIT_SCRIPT = `window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)},window.plausible.init=window.plausible.init||function(i){window.plausible.o=i||{}};window.plausible.init();`

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
          />
          <script async src="https://plausible.io/js/pa-kSnxLJOs-rVla-3VXK8xi.js"></script>
          <script innerHTML={PLAUSIBLE_INIT_SCRIPT} />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
        </head>
        <body
          mix={css({
            margin: 0,
            // Mobile: stop the gray tap flash and keep font sizing stable so
            // rapid button taps don't trigger zoom or text-size adjustments.
            WebkitTapHighlightColor: 'transparent',
            WebkitTextSizeAdjust: '100%',
            touchAction: 'manipulation',
          })}
        >
          {children}
          <script type="module" src={routes.assets.href({ path: 'app/assets/entry.ts' })}></script>
        </body>
      </html>
    )
  }
}

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
