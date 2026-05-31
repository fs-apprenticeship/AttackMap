import { summaryCards } from "./data";
import { StatCard } from "./stat-card";

export function SummaryCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
