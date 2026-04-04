import "./globals.css";
import { BrandProvider } from "@/lib/brand-context";
import { RoleProvider } from "@/lib/role-context";
import { FrameworkProvider } from "@/lib/framework-context";
export const metadata = {
  title: "Groundwork — Competitive Intelligence Platform",
  description: "Groundwork — Competitive Intelligence Platform by Knots & Dots",
  icons: { icon: "/knots-dots-logo.png" },
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RoleProvider>
          <BrandProvider>
            <FrameworkProvider>{children}</FrameworkProvider>
          </BrandProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
