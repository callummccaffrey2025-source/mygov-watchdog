import type { FactStatus, FactKind } from "./schema";
export function inferStatus(kind: FactKind, publisher?: string): FactStatus {
  if (kind === "WATCHDOG_ACTION" && publisher && /ICAC|NACC|IBAC|CCC/i.test(publisher)) return "FINDING";
  if (kind === "COURT_OUTCOME") return "CONVICTION";
  if (kind === "FOI_RELEASE") return "ALLEGATION";
  if (kind === "PROGRAM_ALERT") return "PROGRAM_RISK";
  return "ALLEGATION";
}
