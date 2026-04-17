/** Return an OpenGraph images array using the dynamic /og generator */
export function ogImage(title: string, extras?: { tag?: string; tag2?: string; subtitle?: string }) {
  const q = new URLSearchParams({ title });
  if (extras?.tag) q.set("tag", extras.tag);
  if (extras?.tag2) q.set("tag2", extras.tag2);
  if (extras?.subtitle) q.set("subtitle", extras.subtitle);
  return [`/og?${q.toString()}`];
}
