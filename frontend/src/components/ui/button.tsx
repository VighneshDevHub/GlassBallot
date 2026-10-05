import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAF39F] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#202124] text-white hover:bg-[#2D2E33]",
        destructive:
          "bg-[#E05252] text-white hover:bg-[#CC4242]",
        outline:
          "border border-[#EAEAE5] bg-white hover:bg-[#FAFAF7] hover:text-[#202124]",
        secondary:
          "bg-[#F5F5F4] text-[#202124] hover:bg-[#EDEDE7]",
        ghost: "hover:bg-[#F5F5F4] hover:text-[#202124]",
        link: "text-[#243056] underline-offset-4 hover:underline",
        success: "bg-[#4CAF7A] text-white hover:bg-[#3E9B68]",
        lime: "bg-[#DAF39F] text-[#202124] hover:bg-[#C6E66C]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
