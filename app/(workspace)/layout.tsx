import SiteHeader from "@/components/siteHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader
        homeHref="/dashboard"
        links={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/documents", label: "Documents" },
        ]}
      />
      {children}
    </>
  );
}
