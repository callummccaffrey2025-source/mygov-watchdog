export const metadata = {
  title: "Verity",
  description: "AI-powered political watchdog for Australia",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
