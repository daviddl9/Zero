'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { m } from '@/paraglide/messages';
import {
  Mail,
  Tag,
  Clock,
  User,
  FileText,
  Tags,
  Search,
  Brain,
  CheckCircle,
  Circle,
  Archive,
  FileEdit,
  Bell,
  Zap,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { useState } from 'react';

interface NodePaletteProps {
  onAddNode: (nodeType: string, type: 'trigger' | 'condition' | 'action') => void;
}

const nodeCategories = [
  {
    id: 'triggers',
    label: 'Triggers',
    type: 'trigger' as const,
    nodes: [
      { id: 'email_received', icon: Mail },
      { id: 'email_labeled', icon: Tag },
      { id: 'schedule', icon: Clock },
    ],
  },
  {
    id: 'conditions',
    label: 'Conditions',
    type: 'condition' as const,
    nodes: [
      { id: 'sender_match', icon: User },
      { id: 'subject_match', icon: FileText },
      { id: 'label_match', icon: Tags },
      { id: 'keyword_match', icon: Search },
      { id: 'ai_classification', icon: Brain },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    type: 'action' as const,
    nodes: [
      { id: 'mark_read', icon: CheckCircle },
      { id: 'mark_unread', icon: Circle },
      { id: 'add_label', icon: Tag },
      { id: 'remove_label', icon: Tag },
      { id: 'archive', icon: Archive },
      { id: 'generate_draft', icon: FileEdit },
      { id: 'send_notification', icon: Bell },
      { id: 'run_skill', icon: Zap },
    ],
  },
];

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [openCategories, setOpenCategories] = useState<string[]>(['triggers', 'conditions', 'actions']);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getNodeLabel = (nodeId: string): string => {
    const key = `pages.settings.workflows.nodeTypes.${nodeId}` as keyof typeof m;
    return (m[key] as () => string)?.() || nodeId;
  };

  const getNodeDescription = (nodeId: string): string => {
    const key = `pages.settings.workflows.nodeDescriptions.${nodeId}` as keyof typeof m;
    return (m[key] as () => string)?.() || '';
  };

  return (
    <div className="w-64 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">{m['pages.settings.workflows.editor.addNode']()}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Drag nodes to the canvas or click to add
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {nodeCategories.map((category) => (
            <Collapsible
              key={category.id}
              open={openCategories.includes(category.id)}
              onOpenChange={() => toggleCategory(category.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-2 py-1.5 h-auto"
                >
                  <span className="text-sm font-medium">{category.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      openCategories.includes(category.id) ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {category.nodes.map((node) => {
                  const Icon = node.icon;
                  return (
                    <Button
                      key={node.id}
                      variant="ghost"
                      className="w-full justify-start gap-2 px-2 py-1.5 h-auto text-left"
                      onClick={() => onAddNode(node.id, category.type)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{getNodeLabel(node.id)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getNodeDescription(node.id)}
                        </p>
                      </div>
                      <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  );
                })}
              </CollapsibleContent>
              {category.id !== 'actions' && <Separator className="my-2" />}
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
