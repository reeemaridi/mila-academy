import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo } from "next/font/google";
import "./globals.css";
import SmoothScrollProvider from "./components/SmoothScrollProvider";
import { getSiteContent } from "@/lib/site-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display face for headings: a sturdy grotesque with a width axis, set
// condensed and uppercase in the hero so it reads like a team sheet.
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The public origin, used to turn relative link-preview image paths into
// absolute URLs. A bad value used to throw inside this root layout and take
// down every page — and the likeliest mistake is pasting the Netlify domain
// without "https://", or leaving the variable empty (`??` doesn't catch "").
// So: trim it, supply a missing scheme, and fall back rather than crash the
// whole site over a link-preview URL.
function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      // fall through to the default
    }
  }
  return new URL("http://localhost:3000");
}

// Title, description, tab icon and link-preview image are all editable from
// the dashboard (Website → Site Content → General).
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    metadataBase: siteUrl(),
    title: content.site_title,
    description: content.site_description,
    icons: content.favicon ? { icon: content.favicon } : undefined,
    openGraph: content.share_image ? { images: [content.share_image] } : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      {/* Inline script runs before React hydrates — prevents light/dark flash */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mila-theme')||'dark';document.documentElement.className=document.documentElement.className.replace(/\\b(dark|light)\\b/g,'')+' '+t;document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
