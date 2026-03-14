import "./globals.css";

export const metadata = {
  title: "SB Competitive Audit",
  description: "Scotiabank Business Banking — Competitive Audit Tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
