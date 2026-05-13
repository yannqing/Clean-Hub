type FormSectionProps = {
  title: string;
  children?: React.ReactNode;
};

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
