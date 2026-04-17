export default function manifest() {
  return {
    name: "Verity", short_name: "Verity", start_url: "/", display: "standalone",
    background_color: "#0a0a0a", theme_color: "#16a34a",
    description: "Receipts instead of spin. Personalised briefings on news, bills, and MPs.",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
    scope: "/",
  };
}
