export function LoadingCard(){ return <div className="h-24 rounded-2xl bg-white/5 animate-pulse" /> }
export function Empty({label}:{label:string}){ return <div className="text-sm text-white/60">{label}</div> }
export function ErrorMsg({msg}:{msg:string}){ return <div className="text-sm text-red-400">{msg}</div> }
