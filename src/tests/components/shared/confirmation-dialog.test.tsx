/**
 * ConfirmationDialog Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { Trash } from "lucide-react";

import { render, screen, setup } from "@/tests/utils";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

describe("ConfirmationDialog", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Confirm Action",
    message: "Are you sure you want to proceed?",
  };

  it("renders when open", () => {
    render(<ConfirmationDialog {...defaultProps} />);

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ConfirmationDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("Confirm Action")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    const { user } = setup(<ConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel button clicked", async () => {
    const onClose = vi.fn();
    const { user } = setup(<ConfirmationDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses custom confirm label", () => {
    render(<ConfirmationDialog {...defaultProps} confirmLabel="Delete Forever" />);

    expect(screen.getByRole("button", { name: "Delete Forever" })).toBeInTheDocument();
  });

  it("uses custom cancel label", () => {
    render(<ConfirmationDialog {...defaultProps} cancelLabel="Go Back" />);

    expect(screen.getByRole("button", { name: "Go Back" })).toBeInTheDocument();
  });

  it("renders with danger variant", () => {
    render(<ConfirmationDialog {...defaultProps} variant="danger" />);

    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toBeInTheDocument();
  });

  it("renders with warning variant", () => {
    render(<ConfirmationDialog {...defaultProps} variant="warning" />);

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
  });

  it("renders with success variant", () => {
    render(<ConfirmationDialog {...defaultProps} variant="success" />);

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
  });

  it("renders custom icon", () => {
    render(<ConfirmationDialog {...defaultProps} icon={Trash} />);

    // The icon is rendered inside the modal header
    const header = screen.getByText("Confirm Action").closest("header");
    expect(header?.querySelector("svg")).toBeInTheDocument();
  });

  it("shows loading state on confirm button", () => {
    render(<ConfirmationDialog {...defaultProps} isLoading />);

    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("disables cancel button while loading", () => {
    render(<ConfirmationDialog {...defaultProps} isLoading />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeDisabled();
  });

  it("renders React node as message", () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        message={<div data-testid="custom-message">Custom content</div>}
      />
    );

    expect(screen.getByTestId("custom-message")).toBeInTheDocument();
  });
});
