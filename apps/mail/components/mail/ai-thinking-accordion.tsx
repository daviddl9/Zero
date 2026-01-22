import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2 } from 'lucide-react';

interface AgentThinkingAccordionProps {
  steps: string[];
  isThinking: boolean;
}

export function AgentThinkingAccordion({ steps, isThinking }: AgentThinkingAccordionProps) {
  if (steps.length === 0 && !isThinking) return null;

  return (
    <Accordion type="single" collapsible className="w-full border rounded-md mb-4 bg-muted/20">
      <AccordionItem value="thinking" className="border-b-0">
        <AccordionTrigger className="px-4 py-2 hover:no-underline">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isThinking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </>
            ) : (
              <span>AI thought process</span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-2">
          <ul className="space-y-2">
            {steps.map((step, index) => (
              <li key={`${index}-${step.substring(0, 10)}`} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{step}</span>
              </li>
            ))}
            {isThinking && (
              <li className="text-xs text-muted-foreground italic flex items-center gap-2">
                 <span className="mt-0.5">•</span>
                 <span>...</span>
              </li>
            )}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
