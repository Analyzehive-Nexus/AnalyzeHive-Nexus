export default function UploadProgress({ progress }: { progress: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-[#9aa4b2] mb-2">
        <span>Uploading</span>
        <span>{progress}%</span>
      </div>

      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-[#7cff4e] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
