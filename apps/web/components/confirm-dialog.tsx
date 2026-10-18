"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Confirms a deletion (or another destructive action, named by
 * `confirmLabel` and `pendingLabel`). Stays open (and disabled) while
 * `onConfirm` runs, closes when it succeeds, and toasts its error and stays
 * open when it fails. `children` go between the description and the
 * buttons (e.g. a field to type a name into), and `confirmDisabled` keeps
 * the confirm button off until they're filled in.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onConfirm,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  confirmDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  onConfirm: () => Promise<unknown>;
  confirmLabel?: string;
  pendingLabel?: string;
  confirmDisabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || confirmDisabled}
            onClick={async (event) => {
              event.preventDefault();
              setPending(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (error) {
                toast.error(errorMessage(error));
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
