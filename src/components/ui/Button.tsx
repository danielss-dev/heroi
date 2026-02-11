import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "md", className = "", children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      default: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
      ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800",
      danger: "bg-red-900/50 text-red-300 hover:bg-red-900/80 border border-red-800",
    };

    const sizes = {
      sm: "h-7 px-2.5 text-xs gap-1.5",
      md: "h-8 px-3 text-sm gap-2",
      icon: "h-7 w-7 p-0",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
