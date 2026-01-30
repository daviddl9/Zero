'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { m } from '@/paraglide/messages';
import { X, Trash2 } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { WorkflowNodeData } from './workflow-node';

interface NodeConfigPanelProps {
  node: Node<WorkflowNodeData> | null;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  onDelete: (nodeId: string) => void;
  labels?: Array<{ id: string; name: string }>;
  skills?: Array<{ id: string; name: string }>;
  nodes?: Node<WorkflowNodeData>[];
  edges?: Edge[];
  setEdges?: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function NodeConfigPanel({
  node,
  onClose,
  onUpdate,
  onDelete,
  labels = [],
  skills = [],
  nodes = [],
  edges = [],
  setEdges,
}: NodeConfigPanelProps) {
  if (!node) return null;

  const { data } = node;

  // Get target node ID for a specific output port
  const getConnectionTarget = (sourceId: string, outputIndex: number): string | null => {
    const edge = edges.find(
      (e) => e.source === sourceId && e.sourceHandle === `output-${outputIndex}`
    );
    return edge?.target ?? null;
  };

  // Update connection for an output port
  const handleOutputConnection = (outputIndex: number, targetNodeId: string | null) => {
    if (!setEdges || !node) return;

    setEdges((eds) => {
      // Remove existing edge from this output
      const filtered = eds.filter(
        (e) => !(e.source === node.id && e.sourceHandle === `output-${outputIndex}`)
      );

      // Add new edge if target selected
      if (targetNodeId) {
        return [
          ...filtered,
          {
            id: `${node.id}-${targetNodeId}-${outputIndex}`,
            source: node.id,
            target: targetNodeId,
            sourceHandle: `output-${outputIndex}`,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
            style: { strokeWidth: 2 },
          },
        ];
      }
      return filtered;
    });
  };

  const handleParameterChange = (key: string, value: unknown) => {
    onUpdate(node.id, {
      parameters: {
        ...data.parameters,
        [key]: value,
      },
    });
  };

  const getNodeLabel = (nodeId: string): string => {
    const key = `pages.settings.workflows.nodeTypes.${nodeId}` as keyof typeof m;
    return (m[key] as () => string)?.() || nodeId;
  };

  const renderParameterFields = () => {
    switch (data.nodeType) {
      // Triggers
      case 'email_received':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.folder']()}</Label>
              <Select
                value={(data.parameters.folder as string) || 'inbox'}
                onValueChange={(value) => handleParameterChange('folder', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbox">Inbox</SelectItem>
                  <SelectItem value="all">All Mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'email_labeled':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.label']()}</Label>
              <Select
                value={(data.parameters.label as string) || ''}
                onValueChange={(value) => handleParameterChange('label', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a label" />
                </SelectTrigger>
                <SelectContent>
                  {labels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      {label.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.action']()}</Label>
              <Select
                value={(data.parameters.action as string) || 'added'}
                onValueChange={(value) => handleParameterChange('action', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added">{m['pages.settings.workflows.editor.added']()}</SelectItem>
                  <SelectItem value="removed">{m['pages.settings.workflows.editor.removed']()}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.cron']()}</Label>
              <Input
                value={(data.parameters.cron as string) || ''}
                onChange={(e) => handleParameterChange('cron', e.target.value)}
                placeholder={m['pages.settings.workflows.editor.cronPlaceholder']()}
              />
              <p className="text-xs text-muted-foreground">
                e.g., "0 9 * * *" for every day at 9am
              </p>
            </div>
          </div>
        );

      // Conditions
      case 'sender_match':
      case 'subject_match':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.pattern']()}</Label>
              <Input
                value={(data.parameters.pattern as string) || ''}
                onChange={(e) => handleParameterChange('pattern', e.target.value)}
                placeholder={m['pages.settings.workflows.editor.patternPlaceholder']()}
              />
              <p className="text-xs text-muted-foreground">
                Use * as wildcard (e.g., *@newsletter.com)
              </p>
            </div>
          </div>
        );

      case 'label_match':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.labels']()}</Label>
              <Select
                value={(data.parameters.labels as string[])?.join(',') || ''}
                onValueChange={(value) => handleParameterChange('labels', value.split(',').filter(Boolean))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select labels" />
                </SelectTrigger>
                <SelectContent>
                  {labels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      {label.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.matchMode']()}</Label>
              <Select
                value={(data.parameters.mode as string) || 'any'}
                onValueChange={(value) => handleParameterChange('mode', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{m['pages.settings.workflows.editor.matchAny']()}</SelectItem>
                  <SelectItem value="all">{m['pages.settings.workflows.editor.matchAll']()}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'keyword_match':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.keywords']()}</Label>
              <Textarea
                value={
                  Array.isArray(data.parameters.keywords)
                    ? (data.parameters.keywords as string[]).join(', ')
                    : (data.parameters.keywords as string) || ''
                }
                onChange={(e) => handleParameterChange('keywords', e.target.value)}
                onBlur={(e) =>
                  handleParameterChange(
                    'keywords',
                    e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
                  )
                }
                placeholder={m['pages.settings.workflows.editor.keywordsPlaceholder']()}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.searchLocation']()}</Label>
              <Select
                value={(data.parameters.location as string) || 'both'}
                onValueChange={(value) => handleParameterChange('location', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject">{m['pages.settings.workflows.editor.subject']()}</SelectItem>
                  <SelectItem value="body">{m['pages.settings.workflows.editor.body']()}</SelectItem>
                  <SelectItem value="both">{m['pages.settings.workflows.editor.both']()}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'ai_classification': {
        const categories = Array.isArray(data.parameters.categories)
          ? (data.parameters.categories as string[])
          : [];
        const outputPorts = [...categories, 'other'];
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.categories']()}</Label>
              <Textarea
                value={
                  Array.isArray(data.parameters.categories)
                    ? (data.parameters.categories as string[]).join(', ')
                    : (data.parameters.categories as string) || ''
                }
                onChange={(e) => handleParameterChange('categories', e.target.value)}
                onBlur={(e) =>
                  handleParameterChange(
                    'categories',
                    e.target.value.split(',').map((c) => c.trim()).filter(Boolean)
                  )
                }
                placeholder={m['pages.settings.workflows.editor.categoriesPlaceholder']()}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                AI will classify emails into these categories
              </p>
            </div>

            {/* Output Ports with Action Dropdowns */}
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Output Ports</Label>
                <p className="text-xs text-muted-foreground">
                  Select an action for each category
                </p>
                <div className="space-y-2 mt-2">
                  {outputPorts.map((port, index) => {
                    const currentTarget = getConnectionTarget(node.id, index);
                    const actionNodes = nodes.filter((n) => n.data.type === 'action');

                    return (
                      <div key={`${node.id}-output-${port}`} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                        <span className="text-sm flex-1 truncate" title={port}>{port}</span>
                        <Select
                          value={currentTarget ?? 'none'}
                          onValueChange={(v) => handleOutputConnection(index, v === 'none' ? null : v)}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Do nothing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Do nothing</SelectItem>
                            {actionNodes.map((n) => (
                              <SelectItem key={n.id} value={n.id}>
                                {n.data.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      }

      // Actions
      case 'mark_read':
      case 'mark_unread':
      case 'archive':
        return (
          <p className="text-sm text-muted-foreground">
            This action has no configurable parameters.
          </p>
        );

      case 'add_label':
      case 'remove_label':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.label']()}</Label>
              <Select
                value={(data.parameters.label as string) || ''}
                onValueChange={(value) => handleParameterChange('label', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a label" />
                </SelectTrigger>
                <SelectContent>
                  {labels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      {label.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'send_notification':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.provider']()}</Label>
              <Select
                value={(data.parameters.provider as string) || 'webhook'}
                onValueChange={(value) => handleParameterChange('provider', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">{m['pages.settings.workflows.editor.slack']()}</SelectItem>
                  <SelectItem value="telegram">{m['pages.settings.workflows.editor.telegram']()}</SelectItem>
                  <SelectItem value="webhook">{m['pages.settings.workflows.editor.webhook']()}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.webhookUrl']()}</Label>
              <Input
                value={(data.parameters.config as any)?.url || ''}
                onChange={(e) =>
                  handleParameterChange('config', {
                    ...(data.parameters.config as object),
                    url: e.target.value,
                  })
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.message']()}</Label>
              <Textarea
                value={(data.parameters.message as string) || ''}
                onChange={(e) => handleParameterChange('message', e.target.value)}
                placeholder={m['pages.settings.workflows.editor.messagePlaceholder']()}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{$trigger.sender}}'} and {'{{$trigger.subject}}'} for variables
              </p>
            </div>
          </div>
        );

      case 'generate_draft':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.skillId']()}</Label>
              <Select
                value={(data.parameters.skillId as string) || ''}
                onValueChange={(value) => handleParameterChange('skillId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a skill (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {skills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.instructions']()}</Label>
              <Textarea
                value={(data.parameters.instructions as string) || ''}
                onChange={(e) => handleParameterChange('instructions', e.target.value)}
                placeholder="Additional instructions for generating the draft..."
                rows={4}
              />
            </div>
          </div>
        );

      case 'run_skill':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m['pages.settings.workflows.editor.skillId']()}</Label>
              <Select
                value={(data.parameters.skillId as string) || ''}
                onValueChange={(value) => handleParameterChange('skillId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a skill" />
                </SelectTrigger>
                <SelectContent>
                  {skills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Unknown node type: {data.nodeType}
          </p>
        );
    }
  };

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{m['pages.settings.workflows.editor.configureNode']()}</h3>
          <p className="text-xs text-muted-foreground">{getNodeLabel(data.nodeType)}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Node Name */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={data.label}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
              placeholder="Node name"
            />
          </div>

          <Separator />

          {/* Dynamic Parameters */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Parameters</h4>
            {renderParameterFields()}
          </div>

          <Separator />

          {/* Disabled Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Disabled</Label>
              <p className="text-xs text-muted-foreground">Skip this node during execution</p>
            </div>
            <Switch
              checked={data.disabled || false}
              onCheckedChange={(checked) => onUpdate(node.id, { disabled: checked })}
            />
          </div>
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {m['pages.settings.workflows.editor.deleteNode']()}
        </Button>
      </div>
    </div>
  );
}
