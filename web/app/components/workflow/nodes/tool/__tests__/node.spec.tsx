import type { ToolNodeType } from '../types'
import { render, screen } from '@testing-library/react'
import { useNodes } from 'reactflow'
import { CollectionType } from '@/app/components/tools/types'
import { BlockEnum } from '@/app/components/workflow/types'
import Node from '../node'

const mockUseNodePluginInstallation = vi.hoisted(() => vi.fn())
const mockUseCurrentToolCollection = vi.hoisted(() => vi.fn())

vi.mock('reactflow', async () => {
  const actual = await vi.importActual<typeof import('reactflow')>('reactflow')
  return {
    ...actual,
    useNodes: vi.fn(),
  }
})

vi.mock('@/app/components/workflow/nodes/_base/components/variable/variable-label', () => ({
  VariableLabelInNode: ({
    variables,
    nodeTitle,
    nodeType,
  }: {
    variables: string[]
    nodeTitle?: string
    nodeType?: BlockEnum
  }) => <span>{`${nodeTitle}:${nodeType}:${variables.join('.')}`}</span>,
}))

const mockUseNodes = vi.mocked(useNodes)

vi.mock('../../../hooks/use-node-plugin-installation', () => ({
  useNodePluginInstallation: mockUseNodePluginInstallation,
}))

vi.mock('../hooks/use-current-tool-collection', () => ({
  __esModule: true,
  default: mockUseCurrentToolCollection,
}))

vi.mock('@/app/components/workflow/nodes/_base/components/install-plugin-button', () => ({
  InstallPluginButton: () => <button type="button">Install Plugin</button>,
}))

const createNodeData = (overrides: Partial<ToolNodeType> = {}): ToolNodeType => ({
  title: 'Google Search',
  desc: '',
  type: BlockEnum.Tool,
  provider_id: 'google_search',
  provider_type: CollectionType.builtIn,
  provider_name: 'Google Search',
  tool_name: 'google_search',
  tool_label: 'Google Search',
  tool_parameters: {},
  tool_configurations: {},
  ...overrides,
})

describe('ToolNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNodes.mockReturnValue([])
    mockUseNodePluginInstallation.mockReturnValue({
      isChecking: false,
      isMissing: false,
      uniqueIdentifier: undefined,
      canInstall: false,
      onInstallSuccess: vi.fn(),
      shouldDim: false,
    })
    mockUseCurrentToolCollection.mockReturnValue({
      currentTools: [],
      currCollection: undefined,
    })
  })

  describe('Authorization Warning', () => {
    it('should render the authorization warning when the tool requires authorization and is not authorized', () => {
      mockUseCurrentToolCollection.mockReturnValue({
        currentTools: [],
        currCollection: {
          allow_delete: true,
          is_team_authorization: false,
        },
      })

      render(<Node id="tool-node-1" data={createNodeData()} />)

      expect(screen.getByText('workflow.nodes.tool.authorizationRequired')).toBeInTheDocument()
    })

    it('should keep configuration rows visible when the authorization warning is shown', () => {
      mockUseCurrentToolCollection.mockReturnValue({
        currentTools: [],
        currCollection: {
          allow_delete: true,
          is_team_authorization: false,
        },
      })

      render(
        <Node
          id="tool-node-1"
          data={createNodeData({
            tool_configurations: {
              region: { value: 'us' },
            },
          })}
        />,
      )

      expect(screen.getByText('region')).toBeInTheDocument()
      expect(screen.getByText('workflow.nodes.tool.authorizationRequired')).toBeInTheDocument()
    })

    it('should render nothing when there are no configs, no install action and no authorization warning', () => {
      const { container } = render(<Node id="tool-node-1" data={createNodeData()} />)

      expect(container).toBeEmptyDOMElement()
    })
  })

  it('should render multi-select configuration values', () => {
    render(
      <Node
        id="tool-node-1"
        data={createNodeData({
          tool_configurations: {
            formats: { type: 'constant', value: ['png', 'svg'] },
          },
        })}
      />,
    )

    expect(screen.getByTitle('png, svg')).toHaveTextContent('png, svg')
  })

  it('should resolve variable references to the upstream node title instead of the raw node id', () => {
    mockUseNodes.mockReturnValue([
      {
        id: '1785719614025',
        data: { type: BlockEnum.Start, title: 'File' },
      },
    ] as never)

    render(
      <Node
        id="tool-node-1"
        data={createNodeData({
          tool_configurations: {
            input_file: { type: 'variable', value: ['1785719614025', 'file'] },
          },
        })}
      />,
    )

    expect(screen.getByText(`File:${BlockEnum.Start}:1785719614025.file`)).toBeInTheDocument()
    expect(screen.queryByText('1785719614025, file')).not.toBeInTheDocument()
  })

  it('should render the model name for model-selector configuration values', () => {
    render(
      <Node
        id="tool-node-1"
        data={createNodeData({
          tool_configurations: {
            model: {
              type: 'constant',
              value: {
                provider: 'langgenius/ollama/ollama',
                model: 'gemma4-31b',
                model_type: 'llm',
                mode: 'chat',
                completion_params: {},
              },
            },
          },
        })}
      />,
    )

    expect(screen.getByTitle('gemma4-31b')).toHaveTextContent('gemma4-31b')
  })
})
