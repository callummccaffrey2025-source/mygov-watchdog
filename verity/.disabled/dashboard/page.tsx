import Tag from "@/components/ui/tag";
export const metadata = { title: "Dashboard", alternates: { canonical: "/dashboard" } };
import DashboardHydrate from "@/components/DashboardHydrate";
import BillListItem from "@/components/BillListItem";
import { DashboardEmpty } from "./EmptyState";
export default function Dashboard(){return(<div><h1 className="font-extrabold">Your feed</h1><p className="mt-2 text-neutral-100">News, bills, and MPs tailored to you.</p></div>);}
