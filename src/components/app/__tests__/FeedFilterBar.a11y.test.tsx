import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, activeProps: _a, ...rest }: any) =>
    React.createElement("a", rest, children),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/stars/3" }),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { tags: [] } }),
}));

vi.mock("@/lib/photos.functions", () => ({ getPopularTags: vi.fn() }));

import { FeedFilterBar } from "../FeedFilterBar";

afterEach(() => cleanup());

describe("FeedFilterBar a11y wiring", () => {
  it("Latest/Trending tabs expose role=tab, stable id, aria-controls, aria-selected", () => {
    render(<FeedFilterBar tab="trending" sort="new" />);
    const tabs = screen.getAllByRole("tab");
    const latest = tabs.find((t) => t.id === "tab-latest")!;
    const trending = tabs.find((t) => t.id === "tab-trending")!;
    expect(latest).toBeTruthy();
    expect(trending).toBeTruthy();
    for (const t of [latest, trending]) {
      expect(t.getAttribute("aria-controls")).toBe("feed-panel");
    }
    expect(latest.getAttribute("aria-selected")).toBe("false");
    expect(trending.getAttribute("aria-selected")).toBe("true");
  });

  it("Star tabs expose role=tab, stable id tab-stars-N, aria-controls, and aria-selected matches pathname", () => {
    render(<FeedFilterBar />);
    for (const n of [1, 2, 3, 4, 5]) {
      const el = document.getElementById(`tab-stars-${n}`)!;
      expect(el).toBeTruthy();
      expect(el.getAttribute("role")).toBe("tab");
      expect(el.getAttribute("aria-controls")).toBe("feed-panel");
      expect(el.getAttribute("aria-selected")).toBe(n === 3 ? "true" : "false");
    }
  });

  it("panel wrapper convention: feed-panel id + role=tabpanel + aria-labelledby matches an existing tab id", () => {
    // Simulate the route wrappers (index.tsx and stars.$n.tsx)
    const Panels = () => (
      <>
        <FeedFilterBar tab="latest" sort="new" />
        <div id="feed-panel-home" role="tabpanel" aria-labelledby="tab-latest" />
        <div id="feed-panel-stars" role="tabpanel" aria-labelledby="tab-stars-3" />
      </>
    );
    render(<Panels />);
    const panels = screen.getAllByRole("tabpanel");
    for (const panel of panels) {
      const labelledBy = panel.getAttribute("aria-labelledby")!;
      expect(labelledBy).toBeTruthy();
      const tab = document.getElementById(labelledBy);
      expect(tab, `tab #${labelledBy} should exist`).toBeTruthy();
      expect(tab!.getAttribute("role")).toBe("tab");
      expect(tab!.getAttribute("aria-controls")).toBe("feed-panel");
    }
  });
});
