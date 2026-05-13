"use client";

import type * as React from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      closeButton
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "border-border bg-background text-foreground",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
