type TablePlaceholderProps = {
  columns: string[];
};

export function TablePlaceholder({ columns }: TablePlaceholderProps) {
  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white">
      <div className="grid bg-slate-100 text-xs font-semibold uppercase text-slate-500">
        <div className="grid grid-cols-3">
          {columns.map((column) => (
            <div className="border-r border-slate-200 px-4 py-3" key={column}>
              {column}
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-8 text-sm text-slate-500">
        Table data will be wired to API queries in later iterations.
      </div>
    </div>
  );
}
