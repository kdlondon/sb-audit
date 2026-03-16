import "./globals.css";
import { ProjectProvider } from "@/lib/project-context";
import { RoleProvider } from "@/lib/role-context";
export const metadata = {
  title: "Groundwork — Competitive Intelligence Platform",
  description: "Groundwork — Competitive Intelligence Platform by Knots & Dots",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RoleProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
