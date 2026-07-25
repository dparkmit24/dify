import type { KeyValue } from '../types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import useKeyValueList from '../hooks/use-key-value-list'

const stripIds = (list: KeyValue[]) => list.map(({ key, value }) => ({ key, value }))

const lastEmitted = (onChange: ReturnType<typeof vi.fn>): KeyValue[] =>
  onChange.mock.calls.at(-1)![0]

describe('useKeyValueList (structured model)', () => {
  it('loads a legacy string into the structured list', () => {
    const { result } = renderHook(() => useKeyValueList('a:1\nb:2', vi.fn()))

    expect(stripIds(result.current.list)).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ])
    expect(result.current.list.every((item) => !!item.id)).toBe(true)
  })

  it('loads an already-structured list unchanged', () => {
    const saved: KeyValue[] = [{ id: 'x', key: 'a', value: '1' }]
    const { result } = renderHook(() => useKeyValueList(saved, vi.fn()))

    expect(stripIds(result.current.list)).toEqual([{ key: 'a', value: '1' }])
  })

  it('adds a row and emits the structured list once it has a key and value', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useKeyValueList('a:1', onChange))

    act(() => {
      result.current.addItem()
    })
    expect(stripIds(result.current.list)).toEqual([
      { key: 'a', value: '1' },
      { key: '', value: '' },
    ])

    act(() => {
      result.current.setList([
        ...result.current.list.slice(0, 1),
        { ...result.current.list[1]!, key: 'b', value: '2' },
      ])
    })

    expect(stripIds(lastEmitted(onChange))).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ])
  })

  it('edits a row in place and emits a structured list, not a delimited string', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useKeyValueList('a:1', onChange))

    act(() => {
      result.current.setList([{ ...result.current.list[0]!, value: 'https://x.test:8443/cb' }])
    })

    const emitted = lastEmitted(onChange)
    expect(Array.isArray(emitted)).toBe(true)
    expect(stripIds(emitted)).toEqual([{ key: 'a', value: 'https://x.test:8443/cb' }])
  })

  it('deletes a row', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useKeyValueList('a:1\nb:2', onChange))

    act(() => {
      result.current.setList(result.current.list.filter((item) => item.key !== 'a'))
    })

    expect(stripIds(lastEmitted(onChange))).toEqual([{ key: 'b', value: '2' }])
  })

  it('keeps the row identity stable across an edit so the input does not remount', () => {
    const { result } = renderHook(() => useKeyValueList('a:1', vi.fn()))
    const originalId = result.current.list[0]!.id

    act(() => {
      result.current.setList([{ ...result.current.list[0]!, value: '2' }])
    })

    expect(result.current.list[0]!.id).toBe(originalId)
  })

  it('does not clobber local rows when the external value is structurally unchanged', async () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(({ value }) => useKeyValueList(value, onChange), {
      initialProps: { value: 'a:1' as string | KeyValue[] },
    })

    act(() => {
      result.current.addItem()
    })
    const idsBefore = result.current.list.map((item) => item.id)

    // Same data, different representation — must not reset the half-typed row.
    rerender({ value: [{ id: 'other', key: 'a', value: '1' }] })

    await waitFor(() => {
      expect(result.current.list.map((item) => item.id)).toEqual(idsBefore)
    })
    expect(stripIds(result.current.list)).toEqual([
      { key: 'a', value: '1' },
      { key: '', value: '' },
    ])
  })

  it('resyncs when the external value genuinely changes (e.g. a curl import)', async () => {
    const { result, rerender } = renderHook(({ value }) => useKeyValueList(value, vi.fn()), {
      initialProps: { value: 'a:1' as string | KeyValue[] },
    })

    rerender({ value: [{ id: 'imported', key: 'authorization', value: 'Bearer x' }] })

    await waitFor(() => {
      expect(stripIds(result.current.list)).toEqual([{ key: 'authorization', value: 'Bearer x' }])
    })
  })
})
