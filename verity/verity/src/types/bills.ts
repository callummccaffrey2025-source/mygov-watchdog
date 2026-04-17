export type Bill = {
  id: string;
  title: string | null;
  chamber: string | null;
  stage: string | null;
  source_url: string | null;
  updated_at?: string | null;
};

export type BillSection = {
  id: string;
  bill_id: string;
  ord: number | null;
  heading: string | null;
  text: string | null;
};
