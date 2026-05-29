import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Talkion",
  description: "Gerencie seus alunos e fluxos de inglês via WhatsApp.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TooltipProvider>
          <ProtectedRoute>
            <div className="flex min-h-[100dvh] w-full [overflow-x:clip]">
              {children}
            </div>
          </ProtectedRoute>
          <Toaster position="bottom-right" expand={true} />
        </TooltipProvider>
      </body>
    </html>
  );
}
