import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StratCode",
  description: "Business case assessments.",
};

// Follows the OS light/dark preference. Runs before first paint so there is
// no flash; the `dark` class drives the theme tokens in globals.css.
const themeScript = `(function(){try{var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){document.documentElement.classList.toggle("dark",m.matches)};a();m.addEventListener("change",a)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
