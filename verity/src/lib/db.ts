type MP = { id: string; name: string; party: string; electorate: string; };
type Bill = { id: string; title: string; summary?: string; status?: string; introduced?: string; sponsor?: string; };
type News = { id: string; title: string; outlet?: string; url?: string; };

function loadJSON<T>(p: string, fallback: T): T { try { return JSON.parse(require('fs').readFileSync(p, 'utf8')) as T; } catch { return fallback; } }
const MPs   = loadJSON<MP[]>("./src/data/mps.json", []);
const Bills = loadJSON<Bill[]>("./src/data/bills.json", []);
const NewsA = loadJSON<News[]>("./src/data/sources.json", []);

export const db = {
  mP: {
    async findMany(opts?: any): Promise<MP[]> {
      const s = (opts?.where?.name?.contains || "").toLowerCase?.() || "";
      return !s ? MPs : MPs.filter(m => m.name.toLowerCase().includes(s));
    },
    async findUnique(opts: { where: { id: string } }): Promise<MP|null> {
      return MPs.find(m => m.id === opts?.where?.id) ?? null;
    },
  },
  bill: {
    async findMany(opts?: any): Promise<Bill[]> {
      const s = (opts?.where?.title?.contains || "").toLowerCase?.() || "";
      return !s ? Bills : Bills.filter(b => (b.title||"").toLowerCase().includes(s));
    },
    async findUnique(opts: { where: { id: string } }): Promise<Bill|null> {
      return Bills.find(b => b.id === opts?.where?.id) ?? null;
    },
  },
  news: { async findMany(): Promise<News[]> { return NewsA; } },
  async $queryRaw(_q?: any){ return [{ ok: 1 }]; }
};
export const prisma = db as any;
