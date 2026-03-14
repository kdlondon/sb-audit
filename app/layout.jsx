import "./globals.css";

export const metadata = {
  title: "SB — Business Banking Category Landscape",
  description: "Scotiabank Business Banking — Category Landscape Tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
