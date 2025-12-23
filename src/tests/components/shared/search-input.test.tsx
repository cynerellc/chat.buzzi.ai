/**
 * SearchInput Component Tests
 */

import { describe, it, expect, vi } from "vitest";

import { render, screen, setup, waitFor } from "@/tests/utils";
import { SearchInput } from "@/components/shared/search-input";

describe("SearchInput", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
  };

  it("renders search input", () => {
    render(<SearchInput {...defaultProps} />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders with default placeholder", () => {
    render(<SearchInput {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(<SearchInput {...defaultProps} placeholder="Search items..." />);
    expect(screen.getByPlaceholderText("Search items...")).toBeInTheDocument();
  });

  it("displays the current value", () => {
    render(<SearchInput {...defaultProps} value="test query" />);
    expect(screen.getByRole("searchbox")).toHaveValue("test query");
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    const { user } = setup(<SearchInput value="" onChange={onChange} />);

    await user.type(screen.getByRole("searchbox"), "t");
    expect(onChange).toHaveBeenCalledWith("t");
  });

  it("shows search icon by default", () => {
    const { container } = render(<SearchInput {...defaultProps} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", () => {
    const { container } = render(<SearchInput {...defaultProps} isLoading />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows clear button when value is present", () => {
    render(<SearchInput {...defaultProps} value="test" />);

    const clearButton = screen.getByRole("button");
    expect(clearButton).toBeInTheDocument();
  });

  it("does not show clear button when value is empty", () => {
    render(<SearchInput {...defaultProps} value="" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("clears input and calls onChange when clear button clicked", async () => {
    const onChange = vi.fn();
    const { user } = setup(<SearchInput value="test" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("calls onClear callback when clear button clicked", async () => {
    const onClear = vi.fn();
    const onChange = vi.fn();
    const { user } = setup(<SearchInput value="test" onChange={onChange} onClear={onClear} />);

    await user.click(screen.getByRole("button"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows shortcut hint when provided and input is empty", () => {
    render(<SearchInput {...defaultProps} shortcutHint="⌘K" />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("hides shortcut hint when input has value", () => {
    render(<SearchInput {...defaultProps} value="test" shortcutHint="⌘K" />);
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<SearchInput {...defaultProps} className="custom-class" />);
    // HeroUI Input applies className to the wrapper
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("auto focuses when autoFocus is true", () => {
    render(<SearchInput {...defaultProps} autoFocus />);
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("forwards ref correctly", () => {
    const ref = vi.fn();
    render(<SearchInput {...defaultProps} ref={ref} />);
    expect(ref).toHaveBeenCalled();
  });
});
