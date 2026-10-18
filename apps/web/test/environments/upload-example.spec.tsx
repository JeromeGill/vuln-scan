import { uploadLockfileSchema } from "@repo/contracts";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UploadExample } from "@/containers/environments/upload-example";
import { renderWithProviders } from "../render";

describe("Upload example", () => {
  it("S-0003 AC10: shows a curl command for uploading to this app, with a copy button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadExample />);

    const command = screen.getByText(/^curl /);
    const text = command.textContent ?? "";
    expect(text).toContain(`${window.location.origin}/api/uploads`);
    expect(text).toContain('-H "Authorization: Bearer $VULNSCAN_TOKEN"');
    // Sends every field of the upload body, and only those.
    const fields = [...text.matchAll(/-F "?([a-z]+)=/g)].map(
      ([, name]) => name,
    );
    const bodyFields = Object.keys(uploadLockfileSchema.shape);
    expect(fields).toHaveLength(bodyFields.length);
    expect(fields).toEqual(expect.arrayContaining(bodyFields));
    expect(text).toContain("-F file=@");

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await navigator.clipboard.readText()).toBe(text);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(await screen.findByText("Copied the command.")).toBeInTheDocument();
  });
});
