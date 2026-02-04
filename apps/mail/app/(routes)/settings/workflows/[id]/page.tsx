'use client';

import { useCallback, useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  WorkflowNode,
  type WorkflowNodeData,
  type ExecutionStatus,
  TestWorkflowModal,
  ExecutionHistory,
  WorkflowAISidebar,
  type WorkflowDraft,
  type WorkflowSuggestion,
} from '@/components/workflows';
import { NodePalette } from '@/components/workflows/node-palette';
import { NodeConfigPanel } from '@/components/workflows/node-config-panel';
import {
  useWorkflow,
  useWorkflowMutations,
  type WorkflowNode as WorkflowNodeType,
  type WorkflowConnections,
  type Workflow,
  type TestWorkflowResult,
} from '@/hooks/use-workflows';
import { useLabels } from '@/hooks/use-labels';
import { useSkills } from '@/hooks/use-skills';
import { useWorkflowAI } from '@/hooks/use-workflow-ai';
import { m } from '@/paraglide/messages';
import { ArrowLeft, Save, Play, History, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// Define the React Flow node type with proper constraint
type WorkflowFlowNode = Node<WorkflowNodeData>;

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
  },
  style: {
    strokeWidth: 2,
  },
};

export default function WorkflowEditorPage() {
  const params = useParams();
  const navigate = useNavigate();
  const workflowId = params.id as string;
  const isNew = workflowId === 'new';

  const { data: workflowData, isLoading } = useWorkflow(isNew ? '' : workflowId);
  const { createWorkflow, updateWorkflow } = useWorkflowMutations();
  const { userLabels } = useLabels();
  const { data: skillsData } = useSkills();
  const { isOpen: isAISidebarOpen, setOpen: setAISidebarOpen } = useWorkflowAI();

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowFlowNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  // Workflow metadata
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);

  // Test workflow state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<TestWorkflowResult | null>(null);

  const labels = useMemo(() => userLabels ?? [], [userLabels]);
  const skills = useMemo(() => skillsData?.skills ?? [], [skillsData]);

  // Add highlighted property to nodes based on highlightedNodeIds
  const nodesWithHighlight = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          highlighted: highlightedNodeIds.includes(node.id),
        },
      })),
    [nodes, highlightedNodeIds],
  );

  // Load workflow data
  useEffect(() => {
    if (isNew) {
      setShowNameDialog(true);
      return;
    }

    // Type assertion to handle tRPC inference issues
    const data = workflowData as { workflow: Workflow } | undefined;
    if (data?.workflow) {
      const workflow = data.workflow;
      setWorkflowName(workflow.name);
      setWorkflowDescription(workflow.description || '');

      // Convert workflow nodes to React Flow nodes
      const rfNodes: WorkflowFlowNode[] = (workflow.nodes as WorkflowNodeType[]).map((node) => ({
        id: node.id,
        type: 'workflowNode',
        position: { x: node.position[0], y: node.position[1] },
        data: {
          label: node.name,
          nodeType: node.nodeType,
          type: node.type,
          parameters: node.parameters,
          disabled: node.disabled,
        },
      }));

      // Convert workflow connections to React Flow edges
      const rfEdges: Edge[] = [];
      const connections = workflow.connections as WorkflowConnections;
      Object.entries(connections).forEach(([sourceId, conn]) => {
        conn.main.forEach((outputs, outputIndex) => {
          outputs.forEach((target, targetIdx) => {
            rfEdges.push({
              id: `${sourceId}-${target.node}-${outputIndex}-${targetIdx}`,
              source: sourceId,
              target: target.node,
              sourceHandle: `output-${outputIndex}`,
              targetHandle: undefined, // Use default input handle
              ...defaultEdgeOptions,
            });
          });
        });
      });

      setNodes(rfNodes);
      setEdges(rfEdges);
    }
  }, [workflowData, isNew, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds));
    },
    [setEdges],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      setSelectedNode(node as WorkflowFlowNode);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const getNodeLabel = (nodeId: string): string => {
    const key = `pages.settings.workflows.nodeTypes.${nodeId}` as keyof typeof m;
    return (m[key] as () => string)?.() || nodeId;
  };

  const handleAddNode = useCallback(
    (nodeType: string, type: 'trigger' | 'condition' | 'action') => {
      const newNode: WorkflowFlowNode = {
        id: `${type}-${Date.now()}`,
        type: 'workflowNode',
        position: { x: 250, y: nodes.length * 150 + 50 },
        data: {
          label: getNodeLabel(nodeType),
          nodeType,
          type,
          parameters: {},
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes.length, setNodes],
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );
      // Update selected node if it's the one being edited
      setSelectedNode((prev) =>
        prev?.id === nodeId
          ? { ...prev, data: { ...prev.data, ...data } }
          : prev
      );
    },
    [setNodes],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  const convertToWorkflowFormat = useCallback(() => {
    // Convert React Flow nodes to workflow nodes
    const workflowNodes: WorkflowNodeType[] = nodes.map((node) => ({
      id: node.id,
      type: node.data.type,
      nodeType: node.data.nodeType,
      name: node.data.label,
      position: [node.position.x, node.position.y] as [number, number],
      parameters: node.data.parameters,
      disabled: node.data.disabled,
    }));

    // Convert React Flow edges to workflow connections (n8n format)
    // connections[sourceId].main[outputIndex] = [{ node, index }]
    const connections: WorkflowConnections = {};
    edges.forEach((edge) => {
      // Extract output index from sourceHandle (e.g., "output-0" -> 0)
      const outputIndex = edge.sourceHandle
        ? parseInt(edge.sourceHandle.replace('output-', ''), 10)
        : 0;

      if (!connections[edge.source]) {
        connections[edge.source] = { main: [] };
      }

      // Ensure array exists for this output index
      while (connections[edge.source].main.length <= outputIndex) {
        connections[edge.source].main.push([]);
      }

      connections[edge.source].main[outputIndex].push({
        node: edge.target,
        index: 0,
      });
    });

    return { nodes: workflowNodes, connections };
  }, [nodes, edges]);

  const handleSave = async () => {
    if (!workflowName.trim()) {
      setShowNameDialog(true);
      return;
    }

    setIsSaving(true);
    try {
      const { nodes: workflowNodes, connections } = convertToWorkflowFormat();

      if (isNew) {
        const result = await createWorkflow.mutateAsync({
          name: workflowName,
          description: workflowDescription || undefined,
          nodes: workflowNodes,
          connections,
        });
        toast.success(m['pages.settings.workflows.saveWorkflowSuccess']());
        // Type assertion for tRPC inference issues
        const resultData = result as { workflow: { id: string } };
        navigate(`/settings/workflows/${resultData.workflow.id}`);
      } else {
        await updateWorkflow.mutateAsync({
          id: workflowId,
          name: workflowName,
          description: workflowDescription || undefined,
          nodes: workflowNodes,
          connections,
        });
        toast.success(m['pages.settings.workflows.saveWorkflowSuccess']());
      }
    } catch {
      toast.error(m['pages.settings.workflows.failedToSaveWorkflow']());
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameDialogSubmit = () => {
    if (workflowName.trim()) {
      setShowNameDialog(false);
    }
  };

  const handleTestComplete = useCallback(
    (result: TestWorkflowResult) => {
      setTestResults(result);

      // Update nodes with execution status
      setNodes((nds) =>
        nds.map((node) => {
          const nodeResult = result.nodeResults[node.id];
          let executionStatus: ExecutionStatus = null;
          let matchedCategory: string | undefined;

          if (nodeResult) {
            if (!nodeResult.executed) {
              executionStatus = 'skipped';
            } else if (nodeResult.passed) {
              executionStatus = 'passed';
            } else {
              executionStatus = 'failed';
            }
            matchedCategory = nodeResult.category;
          } else if (result.executionPath.length > 0) {
            // Node wasn't in results but workflow executed - mark as skipped
            executionStatus = 'skipped';
          }

          return {
            ...node,
            data: {
              ...node.data,
              executionStatus,
              matchedCategory,
            },
          };
        }),
      );

      // Update edges to highlight executed path
      setEdges((eds) =>
        eds.map((edge) => {
          const sourceResult = result.nodeResults[edge.source];
          const isOnExecutionPath =
            result.executionPath.includes(edge.source) &&
            result.executionPath.includes(edge.target);

          // Check if this edge's output index matches the executed output
          const outputIndex = edge.sourceHandle
            ? parseInt(edge.sourceHandle.replace('output-', ''), 10)
            : 0;
          const isMatchingOutput =
            sourceResult?.outputIndex === undefined || sourceResult.outputIndex === outputIndex;

          if (isOnExecutionPath && isMatchingOutput && sourceResult?.passed) {
            return {
              ...edge,
              style: {
                ...edge.style,
                stroke: '#10b981',
                strokeWidth: 3,
              },
              animated: true,
            };
          }

          return {
            ...edge,
            style: {
              ...defaultEdgeOptions.style,
            },
            animated: false,
          };
        }),
      );
    },
    [setNodes, setEdges],
  );

  const clearTestResults = useCallback(() => {
    setTestResults(null);
    // Clear execution status from nodes
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          executionStatus: undefined,
          matchedCategory: undefined,
        },
      })),
    );
    // Reset edge styles
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        style: defaultEdgeOptions.style,
        animated: false,
      })),
    );
  }, [setNodes, setEdges]);

  // Apply AI-generated workflow drafts to the canvas
  const handleApplyDraft = useCallback(
    (draft: WorkflowDraft) => {
      // Convert draft nodes to React Flow nodes
      const rfNodes: WorkflowFlowNode[] = draft.nodes.map((node) => ({
        id: node.id,
        type: 'workflowNode',
        position: { x: node.position[0], y: node.position[1] },
        data: {
          label: node.name,
          nodeType: node.nodeType,
          type: node.type,
          parameters: node.parameters,
          disabled: node.disabled,
        },
      }));

      // Convert draft connections to React Flow edges
      const rfEdges: Edge[] = [];
      Object.entries(draft.connections).forEach(([sourceId, conn]) => {
        conn.main.forEach((outputs, outputIndex) => {
          outputs.forEach((target, targetIdx) => {
            rfEdges.push({
              id: `${sourceId}-${target.node}-${outputIndex}-${targetIdx}`,
              source: sourceId,
              target: target.node,
              sourceHandle: `output-${outputIndex}`,
              targetHandle: undefined,
              ...defaultEdgeOptions,
            });
          });
        });
      });

      // Update the canvas
      setNodes(rfNodes);
      setEdges(rfEdges);

      // Update workflow metadata
      if (draft.name) {
        setWorkflowName(draft.name);
      }
      if (draft.description) {
        setWorkflowDescription(draft.description);
      }

      toast.success('Draft applied to canvas');
    },
    [setNodes, setEdges],
  );

  // Apply AI-generated suggestions (from execution analysis)
  const handleApplySuggestion = useCallback(
    (suggestion: WorkflowSuggestion) => {
      // Check if suggestion has a proposed fix
      if (!suggestion.proposedFix) {
        toast.error('No fix available for this suggestion');
        return;
      }

      const { addNodes, removeNodeIds, updateConnections } = suggestion.proposedFix;

      // Start with current nodes and edges
      let updatedNodes = [...nodes];
      let updatedEdges = [...edges];

      // Handle node removals
      if (removeNodeIds && removeNodeIds.length > 0) {
        // Filter out nodes to be removed
        updatedNodes = updatedNodes.filter((node) => !removeNodeIds.includes(node.id));
        // Filter out edges that reference removed nodes
        updatedEdges = updatedEdges.filter(
          (edge) => !removeNodeIds.includes(edge.source) && !removeNodeIds.includes(edge.target),
        );
      }

      // Handle node additions
      if (addNodes && addNodes.length > 0) {
        // Convert to React Flow format
        const newRfNodes: WorkflowFlowNode[] = addNodes.map((node) => ({
          id: node.id,
          type: 'workflowNode',
          position: { x: node.position[0], y: node.position[1] },
          data: {
            label: node.name,
            nodeType: node.nodeType,
            type: node.type,
            parameters: node.parameters,
            disabled: node.disabled,
          },
        }));
        updatedNodes = [...updatedNodes, ...newRfNodes];
      }

      // Handle connection updates
      if (updateConnections) {
        // Convert connections to edges
        const newEdges: Edge[] = [];
        Object.entries(updateConnections).forEach(([sourceId, conn]) => {
          conn.main.forEach((outputs, outputIndex) => {
            outputs.forEach((target, targetIdx) => {
              newEdges.push({
                id: `${sourceId}-${target.node}-${outputIndex}-${targetIdx}`,
                source: sourceId,
                target: target.node,
                sourceHandle: `output-${outputIndex}`,
                targetHandle: undefined,
                ...defaultEdgeOptions,
              });
            });
          });
        });

        // Merge with existing edges, removing duplicates by id
        const existingEdgeIds = new Set(updatedEdges.map((e) => e.id));
        const uniqueNewEdges = newEdges.filter((e) => !existingEdgeIds.has(e.id));
        updatedEdges = [...updatedEdges, ...uniqueNewEdges];
      }

      // Apply updates
      setNodes(updatedNodes);
      setEdges(updatedEdges);

      toast.success(`Applied fix: ${suggestion.title}`);
    },
    [nodes, edges, setNodes, setEdges],
  );

  if (!isNew && isLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings/workflows')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{workflowName || 'New Workflow'}</h1>
            {workflowDescription && (
              <p className="text-sm text-muted-foreground">{workflowDescription}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowNameDialog(true)}>
            Edit Details
          </Button>
          {testResults && (
            <Button variant="ghost" size="sm" onClick={clearTestResults}>
              Clear Results
            </Button>
          )}
          <Button variant="outline" onClick={() => setAISidebarOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            AI Assistant
          </Button>
          {!isNew && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <History className="h-4 w-4 mr-2" />
                  {m['pages.settings.workflows.history.title']?.() || 'History'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <div className="p-4 border-b">
                  <h4 className="font-medium">
                    {m['pages.settings.workflows.history.title']?.() || 'Execution History'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {m['pages.settings.workflows.history.description']?.() || 'Recent workflow executions (30-day retention)'}
                  </p>
                </div>
                <ExecutionHistory workflowId={workflowId} />
              </PopoverContent>
            </Popover>
          )}
          <Button
            variant="outline"
            onClick={() => setIsTestModalOpen(true)}
            disabled={nodes.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            {m['pages.settings.workflows.testWorkflow']()}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? m['common.actions.saving']() : m['common.actions.save']()}
          </Button>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        <NodePalette onAddNode={handleAddNode} />

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodesWithHighlight}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            className="bg-muted/30"
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          </ReactFlow>
        </div>

        {/* Config Panel - hidden when AI sidebar is open */}
        {selectedNode && !isAISidebarOpen && (
          <NodeConfigPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
            labels={labels}
            skills={skills}
            nodes={nodes}
            edges={edges}
            setEdges={setEdges}
          />
        )}

        {/* AI Sidebar */}
        {isAISidebarOpen && (
          <WorkflowAISidebar
            workflowId={isNew ? undefined : workflowId}
            nodes={nodes}
            edges={edges}
            onApplyDraft={handleApplyDraft}
            onApplySuggestion={handleApplySuggestion}
            onHighlightNodes={setHighlightedNodeIds}
            labels={labels.map((l) => ({ id: l.id || l.name, name: l.name }))}
            skills={skills.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))}
            onClose={() => setAISidebarOpen(false)}
          />
        )}
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isNew ? m['pages.settings.workflows.createWorkflow']() : 'Edit Workflow Details'}
            </DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Give your workflow a name and optional description.'
                : 'Update the workflow name and description.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{m['pages.settings.workflows.nameLabel']()}</Label>
              <Input
                id="name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder={m['pages.settings.workflows.namePlaceholder']()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{m['pages.settings.workflows.descriptionLabel']()}</Label>
              <Textarea
                id="description"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder={m['pages.settings.workflows.descriptionPlaceholder']()}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            {!isNew && (
              <Button variant="outline" onClick={() => setShowNameDialog(false)}>
                {m['common.actions.cancel']()}
              </Button>
            )}
            <Button onClick={handleNameDialogSubmit} disabled={!workflowName.trim()}>
              {isNew ? 'Continue' : m['common.actions.save']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Workflow Modal */}
      {isTestModalOpen && (() => {
        const { nodes: workflowNodes, connections: workflowConnections } = convertToWorkflowFormat();
        return (
          <TestWorkflowModal
            open={isTestModalOpen}
            onOpenChange={setIsTestModalOpen}
            workflowId={isNew ? undefined : workflowId}
            nodes={workflowNodes}
            connections={workflowConnections}
            onTestComplete={handleTestComplete}
          />
        );
      })()}
    </div>
  );
}
