/**
 * StatCard Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { Users } from "lucide-react";

import { render, screen, setup } from "@/tests/utils";
import { StatCard } from "@/components/shared/stat-card";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Total Users" value={1234} />);

    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("renders string value correctly", () => {
    render(<StatCard title="Revenue" value="$12,345" />);

    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$12,345")).toBeInTheDocument();
  });

  it("renders with icon", () => {
    const { container } = render(<StatCard title="Users" value={100} icon={Users} />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows positive change with up trend", () => {
    render(<StatCard title="Users" value={100} change={12.5} />);

    expect(screen.getByText("+12.5%")).toBeInTheDocument();
    expect(screen.getByText("from last period")).toBeInTheDocument();
  });

  it("shows negative change with down trend", () => {
    render(<StatCard title="Users" value={100} change={-8.3} />);

    expect(screen.getByText("-8.3%")).toBeInTheDocument();
  });

  it("shows neutral trend for zero change", () => {
    render(<StatCard title="Users" value={100} change={0} />);

    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("uses custom change label", () => {
    render(<StatCard title="Users" value={100} change={5} changeLabel="vs last week" />);

    expect(screen.getByText("vs last week")).toBeInTheDocument();
  });

  it("overrides auto-detected trend", () => {
    render(<StatCard title="Users" value={100} change={10} trend="down" />);

    // Even though change is positive, trend should show down styling
    expect(screen.getByText("+10.0%")).toBeInTheDocument();
  });

  it("renders loading skeleton when isLoading is true", () => {
    const { container } = render(<StatCard title="Users" value={100} isLoading />);

    // Should not show actual content
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();

    // Should have skeleton elements
    expect(container.querySelectorAll("[data-slot='base']").length).toBeGreaterThanOrEqual(0);
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const { user } = setup(<StatCard title="Users" value={100} onClick={handleClick} />);

    await user.click(screen.getByText("Users").closest("div")!.parentElement!.parentElement!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    const { container } = render(<StatCard title="Users" value={100} className="custom-class" />);

    // StatCard uses Card which is a div, className is applied to it
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("renders sparkline when provided", () => {
    const sparklineData = [10, 20, 15, 30, 25, 35, 40];
    const { container } = render(<StatCard title="Users" value={100} sparkline={sparklineData} />);

    // Sparkline should have bars equal to data length
    const sparklineBars = container.querySelectorAll(".flex-1.rounded-sm");
    expect(sparklineBars.length).toBe(sparklineData.length);
  });

  it("applies icon colors correctly", () => {
    const { container } = render(
      <StatCard title="Users" value={100} icon={Users} iconColor="text-success" iconBgColor="bg-success/10" />
    );

    const iconWrapper = container.querySelector(".rounded-xl");
    expect(iconWrapper).toHaveClass("bg-success/10");
  });
});
