import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

interface ConfirmDeleteProps extends SerializableProps {
  // POST target that performs the deletion.
  action: string
  // Question shown in the modal, e.g. 'Delete user "bob" and their 3 games?'
  message: string
  // Current pagination, sent back so the redirect lands on the same pages.
  usersPage: number
  gamesPage: number
}

// Delete button that upgrades to a confirmation modal: the click is
// intercepted and a confirm dialog rendered; the confirm button is a plain
// submit so the actual deletion is still a normal form POST. Without JS the
// trigger submits directly (no confirmation, same as before). While the POST
// is in flight the modal stays open showing a spinner, so the user gets
// feedback until the redirect re-renders the page.
export const ConfirmDelete = clientEntry(
  import.meta.url,
  function ConfirmDelete(handle: Handle<ConfirmDeleteProps>) {
    let open = false
    let submitting = false

    function show(event: Event) {
      event.preventDefault()
      open = true
      handle.update()
    }

    function hide(event: Event) {
      if (submitting) return
      event.preventDefault()
      open = false
      handle.update()
    }

    return () => (
      <form
        method="post"
        action={handle.props.action}
        mix={[
          formStyle,
          on('submit', (event) => {
            if (submitting) {
              event.preventDefault()
              return
            }
            submitting = true
            handle.update()
          }),
          on('keydown', (event) => {
            if (open && (event as KeyboardEvent).key === 'Escape') hide(event)
          }),
        ]}
      >
        <input type="hidden" name="users" value={String(handle.props.usersPage)} />
        <input type="hidden" name="games" value={String(handle.props.gamesPage)} />
        <button type="submit" mix={[triggerStyle, on('click', (event) => show(event))]}>
          Delete
        </button>
        {open ? (
          <div
            mix={[
              overlayStyle,
              on('click', (event) => {
                if (event.target === event.currentTarget) hide(event)
              }),
            ]}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm deletion"
          >
            <div mix={panelStyle}>
              <p mix={messageStyle}>{handle.props.message}</p>
              <p mix={warningStyle}>This cannot be undone.</p>
              <div mix={buttonRowStyle}>
                <button
                  type="button"
                  disabled={submitting}
                  mix={[cancelStyle, on('click', (event) => hide(event))]}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} mix={confirmStyle}>
                  {submitting ? (
                    <>
                      <span mix={spinnerStyle} aria-hidden="true" /> Deleting…
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </form>
    )
  },
)

const formStyle = css({ margin: 0, display: 'inline-flex' })

const triggerStyle = css({
  appearance: 'none',
  border: '1px solid var(--danger, #f85149)',
  borderRadius: 'var(--radius-sm, 8px)',
  background: 'transparent',
  color: 'var(--danger, #f85149)',
  font: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
  padding: '4px 10px',
  '&:hover': { background: 'var(--danger, #f85149)', color: 'var(--accent-ink, #fff)' },
})

const overlayStyle = css({
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(0, 0, 0, 0.55)',
})

const panelStyle = css({
  width: '100%',
  maxWidth: '380px',
  padding: '20px',
  background: 'var(--panel, #161b22)',
  border: 'var(--border-w, 1px) solid var(--border, #2b333d)',
  borderRadius: 'var(--radius-lg, 12px)',
  boxShadow: 'var(--shadow-panel, 0 16px 48px rgba(0, 0, 0, 0.5))',
  textAlign: 'left',
})

const messageStyle = css({ margin: '0 0 4px', fontWeight: 700 })
const warningStyle = css({ margin: '0 0 16px', color: 'var(--muted, #8b949e)', fontSize: '12px' })

const buttonRowStyle = css({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
})

const cancelStyle = css({
  appearance: 'none',
  border: '1px solid var(--border, #2b333d)',
  borderRadius: 'var(--radius-sm, 8px)',
  background: 'transparent',
  color: 'var(--text, #e6edf3)',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
  padding: '6px 14px',
  '&:hover': { borderColor: 'var(--muted, #8b949e)' },
  '&:disabled': { opacity: 0.5, cursor: 'default', '&:hover': { borderColor: 'var(--border, #2b333d)' } },
})

const confirmStyle = css({
  appearance: 'none',
  border: '1px solid var(--danger, #f85149)',
  borderRadius: 'var(--radius-sm, 8px)',
  background: 'var(--danger, #f85149)',
  color: 'var(--accent-ink, #fff)',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  padding: '6px 14px',
  '&:hover': { filter: 'brightness(1.1)' },
  '&:disabled': { opacity: 0.85, cursor: 'default', '&:hover': { filter: 'none' } },
})

const spinnerStyle = css({
  '@keyframes confirm-delete-spin': { to: { transform: 'rotate(360deg)' } },
  display: 'inline-block',
  width: '11px',
  height: '11px',
  marginRight: '6px',
  verticalAlign: '-1px',
  border: '2px solid color-mix(in srgb, var(--accent-ink, #fff) 35%, transparent)',
  borderTopColor: 'var(--accent-ink, #fff)',
  borderRadius: '50%',
  animation: 'confirm-delete-spin 0.6s linear infinite',
})
