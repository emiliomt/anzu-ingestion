import { Linkedin, Twitter, Mail, MapPin } from "lucide-react";
import Link from "next/link";
import { AnzuLogo } from "./AnzuLogo";

const PRODUCT_LINKS = [
  { label: "Invoice Capture",     href: "/product/invoice-ingestion" },
  { label: "OCR + AI Extraction", href: "/product/extraction-ocr" },
  { label: "2/3-Way Matching",    href: "/product/matching" },
  { label: "Approvals",           href: "/product/approvals" },
  { label: "Exceptions",          href: "/product/exceptions" },
  { label: "ERP Integrations",    href: "/product/integrations" },
];

const SOLUTIONS_LINKS = [
  { label: "Construction",   href: "/solutions/construction" },
  { label: "Manufacturing",  href: "/solutions/manufacturing" },
  { label: "Distribution",   href: "/solutions/distribution" },
  { label: "Shared Services",href: "/solutions/shared-services" },
];

const COMPANY_LINKS = [
  { label: "About",        href: "/company/about" },
  { label: "Security",     href: "/security" },
  { label: "Blog",         href: "/resources/blog" },
  { label: "Case Studies", href: "/resources/case-studies" },
  { label: "Contact",      href: "/company/contact" },
];

export function MarketingFooter() {
  return (
    <footer style={{ background: "#0C1B3A" }} className="text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center mb-4">
              <AnzuLogo variant="full" scheme="dark" size={30} />
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-xs">
              Intelligent accounts payable automation for companies in Mexico and Colombia. Reduce errors, accelerate closes and maintain full control.
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>Mexico City, Mexico · Bogotá, Colombia</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>hello@anzuapp.io</span>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <a href="#" className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-orange-500/30 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-orange-500/30 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-xs text-gray-400 hover:text-orange-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Solutions</h4>
            <ul className="space-y-2.5">
              {SOLUTIONS_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-xs text-gray-400 hover:text-orange-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-xs text-gray-400 hover:text-orange-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">© 2026 Anzu Technologies, S.A.P.I. de C.V. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <Link href="/privacy"  className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms"    className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/security" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
