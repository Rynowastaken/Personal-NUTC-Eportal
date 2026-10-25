import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn-style source-owned Button primitive, adapted to the portal palette.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition duration-150 ease-soft-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--control-bg)] text-[var(--control-text)] hover:bg-[var(--control-hover-bg)]",
        outline:
          "border border-white/[.12] bg-white/[.07] text-[var(--foreground)] hover:bg-white/[.10]",
        glass: "shadcn-dashboard-glass text-[var(--foreground)] hover:-translate-y-px",
      },
      size: {
        default: "min-h-[42px] rounded-xl px-3.5",
        sm: "min-h-[36px] rounded-xl px-3 text-xs",
        icon: "h-[42px] w-[42px] rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const Button = React.forwardRef(function Button(
  { asChild = false, className, variant, size, ...props },
  ref,
) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(!asChild ? { type: "button" } : {})}
      {...props}
    />
  );
});
