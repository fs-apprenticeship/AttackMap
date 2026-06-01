import type { getSummaryCards } from "./data";
import { StatCard } from "./stat-card";

type SummaryCardsProps = {
  cards: ReturnType<typeof getSummaryCards>;
};

export function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
