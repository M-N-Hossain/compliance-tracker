import SiteHeader from "@/components/siteHeader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader homeHref="/admin" links={[{ href: "/admin", label: "Pending requests" }]} />
      {children}
    </>
  );
}
