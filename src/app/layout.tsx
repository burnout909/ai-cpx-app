import "./globals.css";

export const metadata = {
  title: "ai-cpx",
  description: "CPX auto grading demo (Next.js API Routes)",
  manifest: "/manifest.json",
  themeColor: "#7553FC",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div>
          {children}
        </div>
      </body>
    </html>
  );
}
