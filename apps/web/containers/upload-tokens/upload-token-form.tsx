"use client";

import {
  createUploadTokenSchema,
  type CreateUploadToken,
} from "@repo/contracts";
import { useForm } from "@tanstack/react-form";
import { useState, type ReactNode } from "react";
import { errorMessage, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { expiryOption, expiryOptions } from "./expiry";

const defaultValues: CreateUploadToken = { name: "", expiresInDays: 90 };

/**
 * A new token's name and expiry, for a dialog. Sends the name as typed (the
 * api trims it); api errors show above the buttons.
 */
export function UploadTokenForm({
  cancel,
  onSubmit,
}: {
  /** The dialog's close button. */
  cancel: ReactNode;
  onSubmit: (value: CreateUploadToken) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues,
    validators: { onChange: createUploadTokenSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await onSubmit(value);
      } catch (caught) {
        setError(errorMessage(caught));
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
            <FormField
              field={field}
              label="Name"
              description="Say where it's used, e.g. the CI workflow."
            >
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
        <form.Field name="expiresInDays">
          {(field) => (
            <FormField field={field} label="Expires after">
              {({ id, invalid }) => (
                <Select
                  name={field.name}
                  value={expiryOption(field.state.value).value}
                  onValueChange={(value) => {
                    const option = expiryOptions.find(
                      (candidate) => candidate.value === value,
                    );
                    if (option) field.handleChange(option.days);
                  }}
                >
                  <SelectTrigger
                    id={id}
                    aria-invalid={invalid}
                    onBlur={field.handleBlur}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expiryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {isSubmitting ? "Creating…" : "Create token"}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
