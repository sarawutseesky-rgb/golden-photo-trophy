import { createFileRoute, redirect } from "@tanstack/react-router";

// Trending was merged into /top. Redirect old links to the equivalent view:
// Top photos in the last day, sorted by vote count.
export const Route = createFileRoute("/trending")({
  beforeLoad: () => {
    throw redirect({ to: "/top", search: { range: "day", sort: "votes" } });
  },
});