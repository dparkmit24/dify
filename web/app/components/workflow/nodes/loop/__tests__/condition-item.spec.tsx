import type { Condition } from '../types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VarType } from '@/app/components/workflow/types'
import ConditionItem from '../components/condition-list/condition-item'
import { ComparisonOperator } from '../types'

vi.mock('@/app/components/base/prompt-editor', () => ({
  __esModule: true,
  default: () => <div data-testid="prompt-editor" />,
}))

const mockWorkflowStoreState = {
  controlPromptEditorRerenderKey: 0,
  pipelineId: undefined as string | undefined,
  setShowInputFieldPanel: vi.fn(),
}

vi.mock('@/app/components/workflow/store', () => ({
  useStore: (selector: (state: typeof mockWorkflowStoreState) => unknown) =>
    selector(mockWorkflowStoreState),
}))

vi.mock('@/app/components/workflow/nodes/_base/components/variable/var-reference-vars', () => ({
  __esModule: true,
  default: ({
    onChange,
  }: {
    onChange: (valueSelector: string[], varItem: { type: VarType }) => void
  }) => (
    <button
      type="button"
      onClick={() => onChange(['node-1', 'is_complete'], { type: VarType.boolean })}
    >
      pick-bool-var
    </button>
  ),
}))

vi.mock('@/app/components/workflow/nodes/_base/components/variable-tag', () => ({
  __esModule: true,
  default: ({ valueSelector }: { valueSelector: string[] }) => <div>{valueSelector.join('.')}</div>,
}))

const createBooleanCondition = (value: Condition['value']): Condition => ({
  id: 'condition-1',
  varType: VarType.boolean,
  variable_selector: ['node-1', 'is_complete'],
  comparison_operator: ComparisonOperator.is,
  value,
})

const renderConditionItem = (condition: Condition, onUpdateCondition = vi.fn()) => {
  render(
    <ConditionItem
      conditionId={condition.id}
      condition={condition}
      onUpdateCondition={onUpdateCondition}
      onRemoveCondition={vi.fn()}
      nodeId="loop-node"
      availableNodes={[]}
      numberVariables={[]}
      availableVars={[]}
    />,
  )
  return onUpdateCondition
}

describe('loop ConditionItem boolean value', () => {
  it.each([
    ['boolean false', false],
    ['legacy string "false"', 'false'],
  ])(
    'should render %s as False and store boolean true when True is selected',
    async (_label, value) => {
      const user = userEvent.setup()
      const onUpdateCondition = renderConditionItem(createBooleanCondition(value))

      // False is the selected option: clicking it is a no-op
      await user.click(screen.getByText('False'))
      expect(onUpdateCondition).not.toHaveBeenCalled()

      await user.click(screen.getByText('True'))
      expect(onUpdateCondition).toHaveBeenCalledWith(
        'condition-1',
        expect.objectContaining({ value: true }),
      )
    },
  )

  it.each([
    ['boolean true', true],
    ['legacy string "true"', 'true'],
  ])(
    'should render %s as True and store boolean false when False is selected',
    async (_label, value) => {
      const user = userEvent.setup()
      const onUpdateCondition = renderConditionItem(createBooleanCondition(value))

      await user.click(screen.getByText('True'))
      expect(onUpdateCondition).not.toHaveBeenCalled()

      await user.click(screen.getByText('False'))
      expect(onUpdateCondition).toHaveBeenCalledWith(
        'condition-1',
        expect.objectContaining({ value: false }),
      )
    },
  )

  it('should reset the value to boolean false when switching to a boolean variable', async () => {
    const user = userEvent.setup()
    const onUpdateCondition = renderConditionItem({
      id: 'condition-1',
      varType: VarType.string,
      variable_selector: ['node-1', 'answer'],
      comparison_operator: ComparisonOperator.contains,
      value: 'hello',
    })

    await user.click(screen.getByText('node-1.answer'))
    await user.click(screen.getByText('pick-bool-var'))

    expect(onUpdateCondition).toHaveBeenCalledWith(
      'condition-1',
      expect.objectContaining({ varType: VarType.boolean, value: false }),
    )
  })
})
