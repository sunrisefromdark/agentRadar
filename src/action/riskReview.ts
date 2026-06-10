import type { ScoredProject } from "../types.ts";

type RiskReviewSubject = Pick<ScoredProject, "score" | "project">;

export function riskReviewRequired(subject: RiskReviewSubject): boolean {
  return (
    subject.score.anti_noise_flags.length > 0 ||
    subject.score.risks.length > 0 ||
    subject.score.data_trust !== "high" ||
    subject.project.trust_flags.length > 0
  );
}

export function buildRiskReviewNote(subject: RiskReviewSubject): string {
  const reasons = [
    subject.score.anti_noise_flags.length > 0 ? `anti_noise=${subject.score.anti_noise_flags.join(", ")}` : undefined,
    subject.score.risks.length > 0 ? `risks=${subject.score.risks.join(", ")}` : undefined,
    subject.score.data_trust !== "high" ? `data_trust=${subject.score.data_trust}` : undefined,
    subject.project.trust_flags.length > 0 ? `trust_flags=${subject.project.trust_flags.join(", ")}` : undefined,
  ].filter((item): item is string => Boolean(item));

  return `它仍然需要谨慎看待，因为 ${reasons.join("，")}。`;
}
