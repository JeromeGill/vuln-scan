"use client";

import { ORPCError } from "@orpc/client";
import { createProjectSchema, type CreateProject } from "@repo/contracts";
import { useForm } from "@tanstack/react-form";
import { useState, type ReactNode } from "react";
import { errorMessage, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * A project's name, for a dialog. Sends the name as typed (the api trims
 * it). A `CONFLICT` (the name is taken) shows on the name field until it's
 * changed; other errors show above the buttons.
 */
export function ProjectForm({
  defaultValues,
  submitLabel,
  pendingLabel,
  cancel,
  onSubmit,
}: {
  defaultValues: CreateProject;
  submitLabel: string;
  pendingLabel: string;
  /** The dialog's close button. */
  cancel: ReactNode;
  onSubmit: (value: CreateProject) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues,
    validators: { onChange: createProjectSchema },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      try {
        await onSubmit(value);
      } catch (caught) {
        if (caught instanceof ORPCError && caught.code === "CONFLICT") {
          // Cleared by the field's next valid change.
          formApi.setFieldMeta("name", (meta) => ({
            ...meta,
            errorMap: {
              ...meta.errorMap,
              onSubmit: { message: caught.message },
            },
          }));
        } else {
          setError(errorMessage(caught));
        }
      }
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => (
            <FormField field={field} label="Name">
              {({ id, invalid }) => (
                <Input
                  id={id}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={invalid}
                  autoComplete="off"
                />
              )}
            </FormField>
          )}
        </form.Field>
        {error && <FieldError>{error}</FieldError>}
        <DialogFooter>
          {cancel}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? pendingLabel : submitLabel}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
