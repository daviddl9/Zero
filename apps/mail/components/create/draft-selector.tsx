import { TextEffect } from '@/components/motion-primitives/text-effect';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X as XIcon } from 'lucide-react';

// Note: This type mirrors the server's DraftResponse type from drafting-agent.ts
// We define it here to avoid cross-package imports and keep the component self-contained
export interface Draft {
  id: string;
  body: string;
  approach: string;
  subject?: string;
  to?: string[];
  cc?: string[];
}

interface DraftSelectorProps {
  drafts: Draft[];
  onSelect: (draft: Draft) => void;
  onReject: () => void;
}

const animations = {
  container: {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { opacity: 1, y: -10, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2 } },
  },
};

export function DraftSelector({ drafts, onSelect, onReject }: DraftSelectorProps) {
  if (drafts.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        variants={animations.container}
        initial="initial"
        animate="animate"
        exit="exit"
        className="dark:bg-subtleBlack absolute bottom-full right-0 z-50 w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-white p-2 shadow-md sm:w-[500px] md:w-[700px]"
      >
        <div className="mb-2 px-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Choose a response approach
          </h3>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {drafts.map((draft, index) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              index={index}
              onSelect={() => onSelect(draft)}
            />
          ))}
        </div>

        <div className="mt-2 flex justify-end px-2">
          <button
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            onClick={onReject}
          >
            <XIcon className="h-3 w-3" />
            <span>Reject all</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function RecipientBadge({ type, email }: { type: 'to' | 'cc'; email: string }) {
  const isTo = type === 'to';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
        isTo
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
      }`}
    >
      <span className="font-medium">+{isTo ? 'To' : 'Cc'}:</span>
      <span className="max-w-[120px] truncate">{email}</span>
    </span>
  );
}

function DraftCard({
  draft,
  index,
  onSelect,
}: {
  draft: Draft;
  index: number;
  onSelect: () => void;
}) {
  const hasRecipients = (draft.to && draft.to.length > 0) || (draft.cc && draft.cc.length > 0);

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
          Option {index + 1}
        </span>
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{draft.approach}</h4>
        {hasRecipients && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {draft.to?.map((email) => <RecipientBadge key={`to-${email}`} type="to" email={email} />)}
            {draft.cc?.map((email) => <RecipientBadge key={`cc-${email}`} type="cc" email={email} />)}
          </div>
        )}
      </div>

      <div
        className="max-h-40 min-h-[100px] flex-1 overflow-auto p-3 text-sm"
        style={{ scrollbarGutter: 'stable' }}
      >
        {draft.body.split('\n').map((line, i) => (
          <TextEffect
            key={`${draft.id}-line-${i}`}
            per="char"
            preset="blur"
            as="div"
            className="whitespace-pre-wrap text-gray-700 dark:text-gray-300"
            speedReveal={3}
          >
            {line || '\u00A0'}
          </TextEffect>
        ))}
      </div>

      <div className="border-t border-gray-200 p-2 dark:border-gray-700">
        <button
          className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-green-700"
          onClick={onSelect}
        >
          <Check className="h-3.5 w-3.5" />
          <span>Select</span>
        </button>
      </div>
    </div>
  );
}
