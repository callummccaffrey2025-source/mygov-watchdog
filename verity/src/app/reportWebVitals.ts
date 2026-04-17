import type { ReportCallback, Metric } from 'web-vitals';

export default function reportWebVitals(metric: Metric) {
  // Always log locally during dev
  if (process.env.NODE_ENV !== "production") {
    console.log("[web-vitals]", metric.name, metric.value, metric);
  }

  // Optional: send to your API (uncomment to enable server logging)
  // navigator.sendBeacon?.(
  //   "/api/metrics",
  //   new Blob([JSON.stringify(metric)], { type: "application/json" })
  // );
}
