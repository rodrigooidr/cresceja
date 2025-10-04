export default function EmojiPicker({ onSelect }) {
  const emojis = ['😀','😂','😍','👍','🙏','😢','😎','🔥','🚀','🎉'];
  return (
    <div className="border p-2 bg-white rounded shadow flex flex-wrap gap-2 max-w-xs mb-2">
      {emojis.map((e) => (
        <button key={e} onClick={() => onSelect(e)} className="text-xl">
          {e}
        </button>
      ))}
    </div>
  );
}
