import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { ThemeSwitcher } from './theme-switcher.tsx'
import { Menu } from 'lucide-remix/icons/menu';

interface MobileHeaderMenuProps extends SerializableProps {
  username?: string | null
  isAdminUser: boolean
  currentTheme: string
  themeAction: string
  homeHref: string
  versusHref: string
  leaderboardHref: string
  profileHref: string
  adminHref: string
  loginHref: string
  signupHref: string
  logoutHref: string
}

export const MobileHeaderMenu = clientEntry(
  import.meta.url,
  function MobileHeaderMenu(handle: Handle<MobileHeaderMenuProps>) {
    let isOpen = false

    function toggleMenu() {
      isOpen = !isOpen
      handle.update()
    }

    function closeMenu() {
      if (!isOpen) return
      isOpen = false
      handle.update()
    }

    return () => {
      let {
        username,
        isAdminUser,
        currentTheme,
        themeAction,
        homeHref,
        versusHref,
        leaderboardHref,
        profileHref,
        adminHref,
        loginHref,
        signupHref,
        logoutHref,
      } = handle.props

      return (
        <div mix={mobileMenuStyle}>
          <button
            type="button"
            mix={[mobileMenuButtonStyle, isOpen ? mobileMenuButtonOpenStyle : null, on('click', toggleMenu)]}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            aria-controls={`${handle.id}-mobile-menu-panel`}
          >
            <Menu width="100%" height="100%" mix={[css({color: 'var(--accent)'})]} />
          </button>
          {isOpen ? (
            <div mix={[mobileMenuOverlayStyle, on('click', closeMenu)]}>
                <div
                  id={`${handle.id}-mobile-menu-panel`}
                  mix={[mobileMenuPanelStyle, on('click', (event) => event.stopPropagation())]}
                >
                  <nav mix={[mobileNavStyle, on('click', closeMenu)]}>
                    <a href={homeHref}>Play</a>
                    <a href={versusHref}>1vs1</a>
                    <a href={leaderboardHref}>Leaderboard</a>
                  {username ? (
                    <>
                      {isAdminUser ? <a href={adminHref}>Admin</a> : null}
                      <a href={profileHref}>{username}</a>
                      <form method="post" action={logoutHref} mix={logoutFormStyle}>
                        <button type="submit" mix={linkButtonStyle}>
                          Log out
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <a href={loginHref}>Log in</a>
                      <a href={signupHref} mix={ctaStyle}>
                        Sign up
                      </a>
                    </>
                  )}
                </nav>
                <div mix={mobileThemeRowStyle}>
                  <span mix={mobileSectionLabelStyle}>Theme</span>
                  <ThemeSwitcher current={currentTheme} action={themeAction} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )
    }
  },
)

const mobileMenuStyle = css({
  display: 'none',
  '@media (max-width: 640px)': {
    display: 'block',
    position: 'relative',
    zIndex: 4,
  },
})

const mobileMenuButtonStyle = css({
  display: 'none',
  '@media (max-width: 640px)': {
    display: 'grid',
    gap: '4px',
    width: '32px',
    height: '32px',
    padding: '8px',
    position: 'relative',
    zIndex: 4,
    borderRadius: 'var(--radius-sm, 8px)',
    border: 'var(--border-w, 1px) solid var(--border)',
    background: 'color-mix(in srgb, var(--panel-2) 80%, transparent)',
    cursor: 'pointer',
    '& span': {
      display: 'block',
      width: '100%',
      height: '2px',
      borderRadius: '999px',
      background: 'var(--text)',
    },
  },
})

const mobileMenuButtonOpenStyle = css({
  '@media (max-width: 640px)': {
    background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
    borderColor: 'var(--accent)',
  },
})

const mobileMenuOverlayStyle = css({
  display: 'none',
  '@media (max-width: 640px)': {
    display: 'flex',
    position: 'fixed',
    inset: 0,
    zIndex: 2,
    padding: '76px 0 0',
    background: 'color-mix(in srgb, var(--bg) 72%, transparent)',
    backdropFilter: 'blur(10px)',
  },
})

const mobileMenuPanelStyle = css({
  display: 'none',
  '@media (max-width: 640px)': {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '16px',
    padding: '28px 20px calc(28px + env(safe-area-inset-bottom))',
    background: 'color-mix(in srgb, var(--panel) 94%, transparent)',
    backdropFilter: 'blur(10px)',
  },
})

const mobileNavStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '22px',
  fontSize: '22px',
  '& a': {
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
  },
  '& span': { color: 'var(--muted)' },
  '& form': { margin: 0 },
  '& button': {
    padding: 0,
    color: 'var(--text)',
    font: 'inherit',
    fontWeight: 700,
  },
})

const mobileThemeRowStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  paddingTop: '14px',
  borderTop: 'var(--border-w, 1px) solid var(--border)',
})

const mobileSectionLabelStyle = css({
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
})

const ctaStyle = css({
  padding: '7px 14px',
  borderRadius: 'var(--radius-sm, 8px)',
  background: 'var(--accent)',
  color: 'var(--accent-ink) !important',
  boxShadow: 'var(--glow, none)',
  fontWeight: 700,
})

const logoutFormStyle = css({ margin: 0, display: 'inline-flex' })
const linkButtonStyle = css({
  appearance: 'none',
  border: 0,
  background: 'transparent',
  color: 'var(--muted)',
  font: 'inherit',
  cursor: 'pointer',
  padding: 0,
  '&:hover': { color: 'var(--text)' },
})
