import { signOut } from "@/auth";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <span className="text-ink text-[17px] font-semibold">Compliance Tracker</span>
        {/* Same server action as the main header in 10b-5 */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="border-line text-body hover:bg-canvas rounded-md border bg-white px-3.5 py-2.5"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">{children}</main>
    </div>
  );
}
