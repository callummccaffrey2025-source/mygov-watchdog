"use client";
import * as React from "react";
export function Tabs({ defaultValue, children, className="" }:{defaultValue:string;children:React.ReactNode;className?:string}) {
  const [v,setV]=React.useState(defaultValue);
  return <div className={className}>
    <TabsContext.Provider value={{v,setV}}>{children}</TabsContext.Provider>
  </div>;
}
const TabsContext = React.createContext<{v:string;setV:(s:string)=>void} | null>(null);
export function TabsList({ children, className="" }:{children:React.ReactNode;className?:string}) {
  return <div className={`flex gap-2 ${className}`}>{children}</div>;
}
export function TabsTrigger({ value, children }:{value:string;children:React.ReactNode}) {
  const ctx = React.useContext(TabsContext)!;
  const active = ctx.v===value;
  return <button onClick={()=>ctx.setV(value)} className={`px-3 py-1 rounded-full text-sm ${active?"bg-white text-black":"bg-white/10 text-white"}`}>{children}</button>;
}
export function TabsContent({ value, children }:{value:string;children:React.ReactNode}) {
  const ctx = React.useContext(TabsContext)!;
  return ctx.v===value ? <div className="mt-3">{children}</div> : null;
}
