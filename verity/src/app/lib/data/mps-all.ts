export type MPBasic = { slug: string; id?: string; name?: string };
export const mpsAll: MPBasic[] = []; // TODO: populate from your real MP dataset
export function getAllMpSlugs(): string[] { return mpsAll.map(m => m.slug); }
export default mpsAll;
