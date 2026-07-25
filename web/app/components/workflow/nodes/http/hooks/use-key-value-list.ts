import type { KeyValue } from '../types'
import { useBoolean } from 'ahooks'
import { uniqueId } from 'es-toolkit/compat'
import { useCallback, useEffect, useState } from 'react'
import {
  isSameKeyValueList,
  normalizeKeyValueList,
  toStructuredKeyValueList,
} from '../structured-key-value'

const UNIQUE_ID_PREFIX = 'key-value-'

/**
 * SPIKE: the editor now owns a structured `KeyValue[]` and hands a structured
 * list to `onChange`. Previously every edit was serialized to `"k:v\nk:v"` and
 * immediately re-parsed, which is where the delimiter collisions were introduced.
 *
 * `value` still accepts the legacy string so existing saved workflows load
 * unchanged; `toStructuredKeyValueList` is the migration boundary.
 */
const useKeyValueList = (
  value: string | KeyValue[],
  onChange: (value: KeyValue[]) => void,
  noFilter?: boolean,
) => {
  const [list, doSetList] = useState<KeyValue[]>(() => toStructuredKeyValueList(value))

  // Empty rows stay in local state so the user can keep typing, but are not
  // persisted — matching the current string model's `item.key && item.value`
  // filter. Changing that is the row-lifecycle bug's territory, not this spike's.
  const toPersisted = useCallback(
    (items: KeyValue[]) => (noFilter ? items : items.filter((item) => item.key && item.value)),
    [noFilter],
  )

  const setList = useCallback(
    (nextList: KeyValue[]) => {
      const normalized = normalizeKeyValueList(nextList)
      doSetList(normalized)
      if (noFilter) return

      const nextPersisted = toPersisted(normalized)
      const currentPersisted = toPersisted(toStructuredKeyValueList(value))
      if (!isSameKeyValueList(nextPersisted, currentPersisted)) onChange(nextPersisted)
    },
    [noFilter, onChange, toPersisted, value],
  )

  useEffect(() => {
    Promise.resolve().then(() => {
      doSetList((prev) => {
        const targetItems = toStructuredKeyValueList(value)
        if (isSameKeyValueList(toPersisted(prev), toPersisted(targetItems))) return prev
        return normalizeKeyValueList(targetItems)
      })
    })
  }, [value, noFilter, toPersisted])

  const addItem = useCallback(() => {
    setList([
      ...list,
      {
        id: uniqueId(UNIQUE_ID_PREFIX),
        key: '',
        value: '',
      },
    ])
  }, [list, setList])

  const [isKeyValueEdit, { toggle: toggleIsKeyValueEdit }] = useBoolean(true)

  return {
    list: list.length === 0 ? [{ id: uniqueId(UNIQUE_ID_PREFIX), key: '', value: '' }] : list, // no item can not add new item
    setList,
    addItem,
    isKeyValueEdit,
    toggleIsKeyValueEdit,
  }
}

export default useKeyValueList
