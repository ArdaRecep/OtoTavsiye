"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";

type ForbiddenWord = { id: string; word: string; active: boolean; created_at: string };

export function AdminModerationManager() {
  const [words, setWords] = useState<ForbiddenWord[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/admin/moderation");
    const data = await response.json();
    if (response.ok) setWords(data.words ?? []);
    else setError(data.error ?? "Kelimeler alınamadı.");
    setIsLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => void fetchWords()); }, [fetchWords]);

  async function addWord(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    const response = await fetch("/api/admin/moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: draft }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Kelime eklenemedi."); return; }
    setDraft("");
    await fetchWords();
  }

  async function toggleWord(item: ForbiddenWord) {
    const response = await fetch("/api/admin/moderation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, active: !item.active }) });
    if (response.ok) setWords((current) => current.map((word) => word.id === item.id ? { ...word, active: !word.active } : word));
  }

  async function deleteWord(item: ForbiddenWord) {
    if (!window.confirm(`“${item.word}” kelimesini listeden silmek istiyor musun?`)) return;
    const response = await fetch("/api/admin/moderation", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    if (response.ok) setWords((current) => current.filter((word) => word.id !== item.id));
  }

  return (
    <section className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#014636]" /><h2 className="text-lg font-semibold">İçerik moderasyonu</h2></div>
      <p className="mt-1 text-sm text-neutral-500">Yorumlarda ve topluluk konularında kullanılamayacak kelimeleri yönet.</p>
      <form onSubmit={addWord} className="mt-4 flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Yeni yasaklı kelime" maxLength={40} className="h-10 min-w-0 flex-1 rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-[#014636] focus:ring-2 focus:ring-emerald-100" /><button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Ekle</button></form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {isLoading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#014636]" /></div> : <div className="mt-4 divide-y divide-neutral-100 rounded-md border border-neutral-200">{words.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><button type="button" onClick={() => toggleWord(item)} className="flex min-w-0 items-center gap-3 text-left"><span className={`h-2.5 w-2.5 rounded-full ${item.active ? "bg-emerald-500" : "bg-neutral-300"}`} /><span className={`truncate text-sm font-semibold ${item.active ? "text-neutral-900" : "text-neutral-400 line-through"}`}>{item.word}</span><span className="text-[10px] text-neutral-400">{item.active ? "Aktif" : "Pasif"}</span></button><button type="button" onClick={() => deleteWord(item)} className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50" aria-label={`${item.word} sil`}><Trash2 className="h-4 w-4" /></button></div>)}</div>}
    </section>
  );
}
