import "./globals.css";

export const metadata = {
  title: "ai-cpx",
  description: "CPX auto grading demo (Next.js API Routes)",
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