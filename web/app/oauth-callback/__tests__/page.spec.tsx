import { render, screen } from '@testing-library/react'
import OAuthCallback from '../page'

const setOpener = (value: unknown) => {
  Object.defineProperty(window, 'opener', {
    value,
    writable: true,
    configurable: true,
  })
}

describe('OAuthCallback page', () => {
  let closeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  afterEach(() => {
    closeSpy.mockRestore()
    setOpener(null)
  })

  it('renders nothing visible when the opener handles the callback', () => {
    setOpener({ origin: window.location.origin, postMessage: vi.fn() })

    render(<OAuthCallback />)

    expect(screen.queryByText(/canCloseWindow/i)).toBeNull()
  })

  it('shows guidance instead of a blank page when window.opener is unavailable', () => {
    setOpener(null)

    render(<OAuthCallback />)

    expect(screen.getByText(/canCloseWindow/i)).toBeInTheDocument()
  })
})
