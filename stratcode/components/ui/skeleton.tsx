import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-[10px] bg-secondary", className)}
      {...props}
    />
  )
}

export { Skeleton }
