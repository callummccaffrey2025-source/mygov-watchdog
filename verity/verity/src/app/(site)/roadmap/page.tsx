export default function RoadmapPage() {
  const items = [
    {
      title: "MP pages",
      desc: "See voting history, speeches and donors in one place.",
    },
    {
      title: "Issue alerts",
      desc: "Get notified the moment something you care about moves.",
    },
    {
      title: "Bill summaries",
      desc: "Plain-English breakdowns updated at each reading stage.",
    },
  ];
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold text-white">Roadmap</h1>
      <ul className="space-y-4 text-zinc-300">
        {items.map((item) => (
          <li
            key={item.title}
            className="border border-zinc-700/50 rounded-lg p-4"
          >
            <div className="text-white font-medium">{item.title}</div>
            <div className="text-zinc-500 text-sm">{item.desc}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
