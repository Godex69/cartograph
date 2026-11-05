import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="mb-6 flex flex-col items-center gap-1">
        <h1 className="font-mono text-sm font-bold tracking-widest text-foreground">
          CARTOGRAPH
        </h1>
        <p className="font-mono text-xs text-foreground-muted">
          Create an account to access your codebase map
        </p>
      </div>
      <Suspense fallback={<div className="font-mono text-xs text-foreground-muted">Loading sign up...</div>}>
        <SignUp />
      </Suspense>
    </div>
  );
}
