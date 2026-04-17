"use client";
import { motion } from "framer-motion";
import Pill from '@/components/ui/pill';

export default function Hero(){
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-8 sm:p-10">
      <div className="pointer-events-none absolute -top-28 -left-28 h-72 w-72 rounded-full bg-emerald/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-emerald/10 blur-3xl" />
      <motion.div
        initial={{ opacity:0, y: 12 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.6, ease:"easeOut" }}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Pill>Source-linked</Pill>
          <Pill>Bias-aware</Pill>
          <Pill>Personalized</Pill>
        </div>
        <h1 className="h1 mb-2">What matters in Australian politics today</h1>
        <p className="lead">Personalized, verifiable clarity across MPs, bills, and news — built for trust.</p>
      </motion.div>
    </div>
  );
}
