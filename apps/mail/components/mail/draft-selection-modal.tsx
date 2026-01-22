import * as React from 'react';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle } from '@/components/responsive-modal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DraftSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: string[];
  onSelect: (draft: string) => void;
}

export function DraftSelectionModal({ open, onOpenChange, drafts, onSelect }: DraftSelectionModalProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-3xl h-[80vh] flex flex-col">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Select a Draft</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 flex-1 min-h-0">
          {drafts.map((draft, index) => (
            <div key={`${index}-${draft.substring(0, 10)}`} className="flex flex-col border rounded-lg p-4 bg-background h-full">
              <div className="mb-2 font-medium">Option {index + 1}</div>
              <ScrollArea className="flex-1 border rounded bg-muted/10 p-2 text-sm whitespace-pre-wrap">
                {draft}
              </ScrollArea>
              <Button className="mt-4 w-full" onClick={() => onSelect(draft)}>
                Use this draft
              </Button>
            </div>
          ))}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}