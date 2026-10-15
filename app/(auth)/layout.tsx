export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <span className="text-ink text-[17px] font-semibold">Compliance Tracker</span>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">{children}</main>
    </div>
  );
}
