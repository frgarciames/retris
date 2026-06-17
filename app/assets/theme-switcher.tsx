import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { getTheme, THEME_LIST, themeVars } from '../ui/themes.ts'

interface ThemeSwitcherProps extends SerializableProps {
  current: string
  // POST target that persists the choice in the theme cookie.
  action: string
}

// No-JS theme picker that upgrades to an instant client-side switch: the
// swatch click applies the theme's CSS variables to the shell root directly
// and persists the cookie with a fetch, so nothing navigates or reloads. The
// form POST (303 back to the Referer) remains as the no-JS fallback.
export const ThemeSwitcher = clientEntry(
  import.meta.url,
  function ThemeSwitcher(handle: Handle<ThemeSwitcherProps>) {
    let current = handle.props.current

    function applyTheme(id: string) {
      let theme = getTheme(id)

      let root = document.querySelector<HTMLElement>('[data-theme]')
      if (root) {
        for (let [name, value] of Object.entries(themeVars(theme))) {
          root.style.setProperty(name, value)
        }
        root.dataset.theme = theme.id
      }

      document
        .querySelector('meta[name="color-scheme"]')
        ?.setAttribute('content', theme.scheme)
      document
        .querySelector<HTMLLinkElement>('link[data-theme-font]')
        ?.setAttribute('href', theme.font.href)

      current = theme.id
      handle.update()
    }

    function choose(event: Event, id: string) {
      event.preventDefault()
      applyTheme(id)
      // Persist for future server renders. Fire-and-forget: the UI already
      // switched, and the worst case of a failed write is the old theme after
      // a reload.
      let body = new FormData()
      body.set('theme', id)
      void fetch(handle.props.action, {
        method: 'POST',
        body,
        headers: { accept: 'application/json' },
      })
    }

    return () => (
      <form method="post" action={handle.props.action} mix={switcherStyle} aria-label="Theme">
        {THEME_LIST.map((theme) => {
          let active = theme.id === current
          return (
            <button
              key={theme.id}
              type="submit"
              name="theme"
              value={theme.id}
              title={theme.label}
              aria-label={`${theme.label} theme`}
              aria-pressed={active}
              mix={[swatchStyle, on('click', (event) => choose(event, theme.id))]}
              style={{
                background: theme.colors.accent,
                boxShadow: `inset 0 0 0 2px ${theme.colors.bg}`,
                outline: active ? '2px solid var(--text)' : '2px solid transparent',
                outlineOffset: '1px',
                opacity: active ? '1' : '0.85',
              }}
            />
          )
        })}
      </form>
    )
  },
)

const switcherStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  margin: 0,
  paddingLeft: '20px',
  borderLeft: 'var(--border-w, 1px) solid var(--border, #2b333d)',
  '@media (max-width: 640px)': {
    justifyContent: 'center',
    paddingLeft: 0,
    borderLeft: 0,
  },
})

const swatchStyle = css({
  appearance: 'none',
  width: '18px',
  height: '18px',
  padding: 0,
  border: 0,
  borderRadius: '50%',
  cursor: 'pointer',
  transition: 'opacity 120ms ease, transform 120ms ease',
  '&:hover': { opacity: 1, transform: 'scale(1.12)' },
  '@media (max-width: 640px)': {
    width: '32px',
    height: '32px',
  },
})
