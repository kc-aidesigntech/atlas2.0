import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "border border-black/80 bg-white text-black hover:bg-white/90 hover:shadow-[0_0_25px_rgba(255,255,255,0.12)]",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-white/25 bg-transparent text-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    ghost: "text-foreground/85",
    link: "text-primary underline-offset-4 hover:underline",
  }

  const sizes = {
    default: "h-10 px-5",
    sm: "h-9 rounded-full px-4 text-xs uppercase tracking-[0.22em]",
    lg: "h-12 rounded-full px-8 text-base",
    icon: "h-10 w-10",
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold uppercase tracking-[0.14em] ring-offset-background transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }

