import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";
export const rlAskPerIP = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m") });
