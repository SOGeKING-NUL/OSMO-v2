// Caps eyebrow label with the signature line, used to open every section.

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center space-x-3">
      <span className="h-px w-12 bg-black"></span>
      <h2 className="font-heading text-sm font-bold tracking-[0.2em]">{children}</h2>
    </div>
  );
}
