import { createFileRoute } from "@tanstack/react-router";

// The game is the original single-file build, served unchanged from /public/game.
// It runs in a same-origin iframe so its own scripts, styles and saved progress stay untouched.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mars Base Buddies — Explore. Manage. Survive." },
      {
        name: "description",
        content: "A colourful 2D Mars exploration and colony game for kids aged 7–12.",
      },
      { property: "og:title", content: "Mars Base Buddies — Explore. Manage. Survive." },
      {
        property: "og:description",
        content: "A colourful 2D Mars exploration and colony game for kids aged 7–12.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="fixed inset-0 bg-background">
      <iframe
        src="/game/mars-base-buddies.html"
        title="Mars Base Buddies game"
        className="h-full w-full border-0"
        allow="autoplay; fullscreen"
      />
    </main>
  );
}
