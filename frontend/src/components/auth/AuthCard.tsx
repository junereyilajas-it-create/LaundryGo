import * as React from "react";
import { cn } from "@/lib/utils";
import { Droplets } from "lucide-react";

export function AuthCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-md", className)}
      {...props}
    >
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="mb-4 flex items-center justify-center bg-primary-container p-3 rounded-lg text-on-primary shadow-sm">
          <Droplets className="h-8 w-8" />
        </div>
        <h1 className="text-3xl text-primary font-bold tracking-tight">LaundryGo</h1>
        <p className="text-sm text-secondary uppercase tracking-widest mt-1">Portal</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low shadow-[0px_4px_20px_rgba(26,54,93,0.05)] backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 pointer-events-none" />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-6 animate-in fade-in rounded-lg border border-error/20 bg-error-container p-4 text-sm text-on-error-container">
      {message}
    </div>
  );
}
