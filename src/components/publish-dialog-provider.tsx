"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ItemFormDialog } from "@/components/item-form-dialog";

type PublishDialogContextValue = { openPublish: () => void };

const PublishDialogContext = createContext<PublishDialogContextValue | null>(null);

export function PublishDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPublish = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openPublish }), [openPublish]);

  return (
    <PublishDialogContext.Provider value={value}>
      {children}
      <ItemFormDialog open={open} onOpenChange={setOpen} mode="create" />
    </PublishDialogContext.Provider>
  );
}

export function usePublishDialog() {
  const context = useContext(PublishDialogContext);
  if (!context) throw new Error("usePublishDialog must be used inside PublishDialogProvider");
  return context;
}
