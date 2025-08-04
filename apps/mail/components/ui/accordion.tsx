import * as React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

const AccordionRoot = Accordion.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof Accordion.Item>,
  React.ComponentPropsWithoutRef<typeof Accordion.Item>
>(({ children, className, ...props }, forwardedRef) => (
  <Accordion.Item
    className={cn(
      "border border-white/10 rounded-lg overflow-hidden mb-2 bg-black",
      className,
    )}
    {...props}
    ref={forwardedRef}
  >
    {children}
  </Accordion.Item>
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof Accordion.Trigger>,
  React.ComponentPropsWithoutRef<typeof Accordion.Trigger> & {
    showIcon?: boolean;
    iconClassName?: string;
  }
>(({ children, className, showIcon = true, iconClassName, ...props }, forwardedRef) => (
  <Accordion.Header className="flex">
    <Accordion.Trigger
      className={cn(
        "group flex flex-1 items-center justify-between py-4 px-4 text-left text-white hover:text-white/80 transition-colors outline-none [&[data-state=open]>svg]:rotate-180 bg-black",
        className,
      )}
      {...props}
      ref={forwardedRef}
    >
      <span className="text-base font-medium leading-relaxed pr-3">{children}</span>
      {showIcon && (
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 text-white/60 transition-transform duration-350 ease-[cubic-bezier(0.87,_0,_0.13,_1)] flex-shrink-0",
            iconClassName
          )}
          aria-hidden
        />
      )}
    </Accordion.Trigger>
  </Accordion.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof Accordion.Content>,
  React.ComponentPropsWithoutRef<typeof Accordion.Content>
>(({ children, className, ...props }, forwardedRef) => (
  <Accordion.Content
    className={cn(
      "overflow-hidden text-white/70 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down bg-black",
      className,
    )}
    style={{
      animationDuration: '350ms',
      animationTimingFunction: 'cubic-bezier(0.87, 0, 0.13, 1)'
    }}
    {...props}
    ref={forwardedRef}
  >
    <div className="px-4 pb-4 pt-1 text-sm leading-relaxed">{children}</div>
  </Accordion.Content>
));
AccordionContent.displayName = "AccordionContent";

// Light theme variants for use in different contexts
const AccordionTriggerLight = React.forwardRef<
  React.ElementRef<typeof Accordion.Trigger>,
  React.ComponentPropsWithoutRef<typeof Accordion.Trigger> & {
    showIcon?: boolean;
    iconClassName?: string;
  }
>(({ children, className, showIcon = true, iconClassName, ...props }, forwardedRef) => (
  <Accordion.Header className="flex">
    <Accordion.Trigger
      className={cn(
        "group flex flex-1 items-center justify-between py-4 px-4 text-left text-gray-900 hover:text-gray-700 transition-colors outline-none [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
      ref={forwardedRef}
    >
      <span className="text-base font-medium pr-3">{children}</span>
      {showIcon && (
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 text-gray-600 transition-transform duration-350 ease-[cubic-bezier(0.87,_0,_0.13,_1)] flex-shrink-0",
            iconClassName
          )}
          aria-hidden
        />
      )}
    </Accordion.Trigger>
  </Accordion.Header>
));
AccordionTriggerLight.displayName = "AccordionTriggerLight";

const AccordionContentLight = React.forwardRef<
  React.ElementRef<typeof Accordion.Content>,
  React.ComponentPropsWithoutRef<typeof Accordion.Content>
>(({ children, className, ...props }, forwardedRef) => (
  <Accordion.Content
    className={cn(
      "overflow-hidden text-gray-600 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className,
    )}
    style={{
      animationDuration: '350ms',
      animationTimingFunction: 'cubic-bezier(0.87, 0, 0.13, 1)'
    }}
    {...props}
    ref={forwardedRef}
  >
    <div className="px-4 pb-4 pt-1 text-sm leading-relaxed">{children}</div>
  </Accordion.Content>
));
AccordionContentLight.displayName = "AccordionContentLight";

const AccordionItemLight = React.forwardRef<
  React.ElementRef<typeof Accordion.Item>,
  React.ComponentPropsWithoutRef<typeof Accordion.Item>
>(({ children, className, ...props }, forwardedRef) => (
  <Accordion.Item
    className={cn(
      "border border-gray-200 rounded-lg overflow-hidden mb-2",
      className,
    )}
    {...props}
    ref={forwardedRef}
  >
    {children}
  </Accordion.Item>
));
AccordionItemLight.displayName = "AccordionItemLight";

export { 
  AccordionRoot as Accordion,
  AccordionItem, 
  AccordionTrigger, 
  AccordionContent,
  AccordionItemLight,
  AccordionTriggerLight,
  AccordionContentLight
};
