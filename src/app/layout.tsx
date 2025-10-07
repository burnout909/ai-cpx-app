import "./globals.css";

export const metadata = {
  title: "ai-cpx",
  description: "CPX auto grading demo (Next.js API Routes)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="w-full max-w-[450px] min-h-screen mx-auto bg-[#FAFAFA]">
          {children}

        </div>
      </body>
    </html>
  );
}