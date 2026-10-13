import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";
import { Login } from "@/components/Login";
import { BrainApp } from "@/components/BrainApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cervello digitale — le tue idee in costellazioni" },
      { name: "description", content: "Note, ricordi e idee che si collegano per significato in un grafo 3D luminoso." },
      { property: "og:title", content: "Cervello digitale" },
      { property: "og:description", content: "Note, ricordi e idee che si collegano per significato in un grafo 3D luminoso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const session = useSession();
  if (session === undefined) return <div className="min-h-screen bg-background" />;
  if (!session) return <Login />;
  return <BrainApp session={session} />;
}
