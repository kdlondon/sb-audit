import "./globals.css";
import { ProjectProvider } from "@/lib/project-context";
export const metadata = {
  title: "SB — Business Banking Category Landscape",
  description: "Scotiabank Business Banking — Category Landscape Tool",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><ProjectProvider>{children}</ProjectProvider></body>
    </html>
  );
}
