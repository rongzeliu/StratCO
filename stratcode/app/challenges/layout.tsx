import { AppHeader } from "@/components/app-header";

export default function ChallengesLayout({
  children,
}: LayoutProps<"/challenges">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-6 py-10">
        {children}
      </main>
    </div>
  );
}
