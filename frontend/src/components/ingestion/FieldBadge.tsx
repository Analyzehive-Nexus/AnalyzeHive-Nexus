export default function FieldBadge({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <span
      className={`
        px-2 py-1 rounded-full text-xs
        ${
          required
            ? "bg-red-500/10 text-red-400 border border-red-400/30"
            : "bg-white/5 text-[#9aa4b2]"
        }
      `}
    >
      {label}
      {required && " *"}
    </span>
  );
}
