import { renderHook } from '@testing-library/react'
import { useOAuthCallback } from './use-oauth'

const setOpener = (value: unknown) => {
  Object.defineProperty(window, 'opener', {
    value,
    writable: true,
    configurable: true,
  })
}

describe('useOAuthCallback', () => {
  let closeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  afterEach(() => {
    closeSpy.mockRestore()
    setOpener(null)
  })

  it('notifies the opener and closes the popup when window.opener is available', () => {
    const postMessage = vi.fn()
    setOpener({ origin: window.location.origin, postMessage })

    const { result } = renderHook(() => useOAuthCallback())

    expect(postMessage).toHaveBeenCalledWith({ type: 'oauth_callback' }, window.location.origin)
    expect(closeSpy).toHaveBeenCalled()
    expect(result.current).toBe(true)
  })

  it('still tries to close and reports the missing opener when window.opener is unavailable', () => {
    setOpener(null)

    const { result } = renderHook(() => useOAuthCallback())

    expect(closeSpy).toHaveBeenCalled()
    expect(result.current).toBe(false)
  })
})
