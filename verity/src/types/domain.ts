export type MP = { id:string; name:string; party:string; electorate:string; score?:number };
export type Bill = { id:string; title:string; stage:string; updated:string; support?:number; oppose?:number };
export type NewsItem = { id:string; title:string; source:string; date:string; bias?: "Left"|"Centre"|"Right" };
