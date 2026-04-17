export type DataField = { name: string; type: "string"|"number"|"date"|"url"|"badge"|"rich"; required?: boolean };
export type DataSource = {
  id: string; mode: "server"|"client"; endpoint: string; method: "GET";
  params?: { name: string; from: "route"|"query" }[];
  fields: DataField[];
};
export type Section =
  | { kind: "Hero"; title: string; subtitle?: string; icon?: string; datasource: string; fields: string[] }
  | { kind: "Tabs"; tabs: { label: string; sections: Section[] }[] }
  | { kind: "CardList"; title?: string; datasource: string; fields: string[] };
export type PageSpec = {
  route: string; name: string; layout: "app";
  datasources: DataSource[]; sections: Section[];
  seo?: { title: string; description?: string };
};
export const MP_PROFILE: PageSpec = {
  route: "/mps/[slug]",
  name: "MP Profile",
  layout: "app",
  seo: { title: "MP Profile • Verity", description: "Voting record, speeches, interests" },
  datasources: [
    { id: "mp.bySlug", mode: "server", endpoint: "/api/mps/[slug]", method: "GET",
      params: [{ name: "slug", from: "route" }],
      fields: [
        { name: "name", type: "string", required: true },
        { name: "party", type: "badge" },
        { name: "electorate", type: "string" },
        { name: "photoUrl", type: "url" },
        { name: "lastUpdated", type: "date" }
      ]},
    { id: "mp.votes", mode: "server", endpoint: "/api/mps/[slug]/votes", method: "GET",
      params: [{ name: "slug", from: "route" }],
      fields: [
        { name: "bill", type: "string", required: true },
        { name: "position", type: "badge" },
        { name: "date", type: "date" }
      ]}
  ],
  sections: [
    { kind: "Hero", title: "{mp.bySlug.name}", subtitle: "{mp.bySlug.electorate}", icon: "User",
      datasource: "mp.bySlug", fields: ["photoUrl","party","lastUpdated"] },
    { kind: "Tabs", tabs: [
      { label: "Overview", sections: [
        { kind: "CardList", title: "Snapshot", datasource: "mp.bySlug", fields: ["party","electorate","lastUpdated"] }
      ]},
      { label: "Votes", sections: [
        { kind: "CardList", title: "Recent Votes", datasource: "mp.votes", fields: ["bill","position","date"] }
      ]}
    ]}
  ]
};
