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
            ? "bg-danger-tint text-danger border border-danger-line"
            : "bg-elevated text-muted"
        }
      `}
    >
      {label}
      {required && " *"}
    </span>
  );
}
