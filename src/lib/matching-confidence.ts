export function normalizeConfidence(rawConfidence: number): number {
  if (!Number.isFinite(rawConfidence)) return 0;
  return Math.min(1, Math.max(0, rawConfidence));
}

export function boostMatchConfidence(
  rawConfidence: number,
  options?: { isConfirmed?: boolean }
): number {
  const normalized = normalizeConfidence(rawConfidence);

  // Matched invoices get a small confidence uplift and a minimum floor.
  const matchedBoost = 0.05;
  const matchedFloor = 0.75;
  let boosted = Math.max(normalized + matchedBoost, matchedFloor);

  // Confirmed matches should be reflected with stronger confidence.
  if (options?.isConfirmed) {
    const confirmedBoost = 0.05;
    const confirmedFloor = 0.9;
    boosted = Math.max(boosted + confirmedBoost, confirmedFloor);
  }

  return Math.min(1, Number(boosted.toFixed(4)));
}
