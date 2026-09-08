export default function UploadProgress({ progress }: { progress: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-2">
        <span>Uploading</span>
        <span>{progress}%</span>
      </div>

      <div className="h-2 rounded-full bg-sunken overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
