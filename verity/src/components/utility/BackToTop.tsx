"use client";
import { useEffect, useState } from "react";
export default function BackToTop(){
  const [show, setShow] = useState(false);
  useEffect(()=>{
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll(); window.addEventListener('scroll', onScroll, {passive:true});
    return ()=> window.removeEventListener('scroll', onScroll);
  }, []);
  if(!show) return null;
  return (
    <button
      onClick={()=>window.scrollTo({top:0, behavior:'smooth'})}
      className="fixed bottom-6 right-6 rounded-full bg-white/10 px-3 py-2 text-sm backdrop-blur hover:bg-white/15"
      aria-label="Back to top"
    >
      ↑ Top
    </button>
  );
}
