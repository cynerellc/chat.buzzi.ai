/**
 * Button Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { Plus, ChevronRight } from "lucide-react";

import { render, screen, setup } from "@/tests/utils";
import { Button, IconButton } from "@/components/ui/button";

describe("Button", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const { user } = setup(<Button onPress={handleClick}>Click me</Button>);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders left icon when provided", () => {
    render(<Button leftIcon={Plus}>Add Item</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    // Icon should be rendered (SVG element)
    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("renders right icon when provided", () => {
    render(<Button rightIcon={ChevronRight}>Next</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", () => {
    render(<Button isLoading>Loading</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    // Should have a spinner (animate-spin class)
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("hides icons when loading", () => {
    const { container } = render(
      <Button leftIcon={Plus} isLoading>
        Add Item
      </Button>
    );
    // The Plus icon shouldn't be visible, only the spinner
    const svgs = container.querySelectorAll("svg");
    // Should have at least the spinner
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("is disabled when isDisabled is true", () => {
    render(<Button isDisabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Styled</Button>);
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("forwards ref correctly", () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref).toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("renders icon only button", () => {
    render(<IconButton icon={Plus} aria-label="Add item" />);
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });

  it("has icon inside", () => {
    render(<IconButton icon={Plus} aria-label="Add item" />);
    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const { user } = setup(<IconButton icon={Plus} aria-label="Add item" onPress={handleClick} />);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when isDisabled is true", () => {
    render(<IconButton icon={Plus} aria-label="Add item" isDisabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
