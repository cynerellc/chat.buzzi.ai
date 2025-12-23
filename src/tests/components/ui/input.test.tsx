/**
 * Input Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { Search, Eye } from "lucide-react";

import { render, screen, setup } from "@/tests/utils";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders input element", () => {
    render(<Input aria-label="Test input" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("accepts and displays value", () => {
    render(<Input value="Hello" aria-label="Test input" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("Hello");
  });

  it("calls onChange when typing", async () => {
    const handleChange = vi.fn();
    const { user } = setup(<Input aria-label="Test input" onChange={handleChange} />);

    await user.type(screen.getByRole("textbox"), "test");
    expect(handleChange).toHaveBeenCalled();
  });

  it("renders with placeholder", () => {
    render(<Input placeholder="Enter text..." aria-label="Test input" />);
    expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument();
  });

  it("renders left icon when provided", () => {
    const { container } = render(<Input leftIcon={Search} aria-label="Search" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders right icon when provided", () => {
    const { container } = render(<Input rightIcon={Eye} aria-label="Password" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("displays helper text", () => {
    render(<Input helperText="This is helper text" aria-label="Test input" />);
    expect(screen.getByText("This is helper text")).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(<Input errorMessage="This field is required" isInvalid aria-label="Test input" />);
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("is disabled when isDisabled is true", () => {
    render(<Input isDisabled aria-label="Test input" />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("is readonly when isReadOnly is true", () => {
    render(<Input isReadOnly aria-label="Test input" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("applies custom className", () => {
    const { container } = render(<Input className="custom-class" aria-label="Test input" />);
    // HeroUI Input wraps the input, className is applied to the wrapper
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<Input label="Email" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders with required indicator", () => {
    render(<Input label="Email" isRequired />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("handles different input types", () => {
    render(<Input type="email" aria-label="Email input" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });
});
