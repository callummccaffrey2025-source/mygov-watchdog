import { NextResponse } from "next/server";
import type { MPProfile } from "@/types/mp";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;

  const demo: MPProfile = {
    slug,
    name: slug === "alba" ? "Anthony Albanese" : "Unknown MP",
    party: "Labor",
    electorate: "Grayndler",
    state: "NSW",
    headshot_url: null,
    party_logo_url: null,
    roles: [{ title: "Prime Minister", since: "2022-05-23" }],
    committees: [ { name: "House Standing Committee on Procedure", role: "Member" } ],
    recent_votes: [
      { bill_id: "privacy-amendment-2025", bill_title: "Privacy Amendment Bill", stage: "Second reading", date: new Date().toISOString(), decision: "Aye" }
    ],
    news: [],
    offices: [
      { kind: "Parliament", address: "Parliament House\nCanberra ACT 2600", phone: "(02) 6277 7700", email: null },
      { kind: "Electorate", address: "334A Marrickville Rd\nMarrickville NSW 2204", phone: "(02) 9564 3588", email: "A.Albanese.MP@aph.gov.au" }
    ]
  };

  return NextResponse.json(demo, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
