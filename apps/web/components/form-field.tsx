"use client";

import type { AnyFieldApi } from "@tanstack/react-form";
import { useId, type ReactNode } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

/**
 * Label, control, and errors for a TanStack Form field. Errors show once the
 * field has been touched (all fields are touched on submit). The control's
 * id is unique on the page, so two forms with the same field names can be
 * open at once.
 */
export function FormField({
  field,
  label,
  description,
  children,
}: {
  field: AnyFieldApi;
  label: string;
  description?: ReactNode;
  children: (props: { id: string; invalid: boolean }) => ReactNode;
}) {
  const id = `${useId()}-${field.name}`;
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({ id, invalid })}
      {description && !invalid && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {invalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

/** Message for a failed request, e.g. a CONFLICT from the api. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}
