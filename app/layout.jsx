import "./globals.css";
import { ProjectProvider } from "@/lib/project-context";
import { RoleProvider } from "@/lib/role-context";
import ChatBubble from "@/components/ChatBubble";
export const metadata = {
  title: "Groundwork — Competitive Intelligence Platform",
  description: "Groundwork — Competitive Intelligence Platform by Knots & Dots",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RoleProvider>
          <ProjectProvider>
            {children}
            <ChatBubble />
          </ProjectProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
