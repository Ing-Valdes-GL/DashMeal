export default function SuperadminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(249,115,22,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
