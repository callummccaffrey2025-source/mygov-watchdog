export type TelemetryEvent =
 | { type:"ask_submitted"; q:string; ts:number }
 | { type:"answer_rendered"; latency_ms:number; confidence?:number; ts:number }
 | { type:"cite_clicked"; url:string; ts:number }
 | { type:"alert_created"; target:string; ts:number };
export function emit(e:TelemetryEvent){ try{ if(process.env.NODE_ENV!=="production") console.debug("[telemetry]",e);}catch{} }
