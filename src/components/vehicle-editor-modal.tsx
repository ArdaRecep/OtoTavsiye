"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Save, Trash2, X } from "lucide-react";
import type { AdminVehicle } from "@/lib/vehicles/admin";

type VehicleDraft = Omit<AdminVehicle, "created_at" | "updated_at">;

const scoreFields: Array<{ key: keyof VehicleDraft; label: string }> = [
  { key: "safety_score", label: "Güvenlik" },
  { key: "efficiency_score", label: "Ekonomi" },
  { key: "family_score", label: "Aile" },
  { key: "comfort_score", label: "Konfor" },
  { key: "performance_score", label: "Performans" },
  { key: "youth_score", label: "Genç" },
  { key: "resale_score", label: "İkinci el" },
  { key: "city_score", label: "Şehir" },
  { key: "long_trip_score", label: "Uzun yol" },
  { key: "maintenance_score", label: "Bakım" },
  { key: "tech_score", label: "Teknoloji" },
];

export function VehicleEditorModal({
  isOpen,
  vehicleId,
  onClose,
  onSaved,
  onDeleted,
}: {
  isOpen: boolean;
  vehicleId?: string | null;
  onClose: () => void;
  onSaved?: (vehicle: AdminVehicle) => void;
  onDeleted?: (vehicleId: string) => void;
}) {
  const [form, setForm] = useState<VehicleDraft>(createEmptyVehicle);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";

    if (!vehicleId) {
      queueMicrotask(() => {
        setError(null);
        setForm(createEmptyVehicle());
        setIsLoading(false);
      });
    } else {
      const controller = new AbortController();
      queueMicrotask(() => {
        setError(null);
        setIsLoading(true);
      });
      fetch(`/api/admin/vehicles?id=${encodeURIComponent(vehicleId)}`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Araç alınamadı.");
          setForm(data.vehicle as VehicleDraft);
        })
        .catch((requestError) => {
          if (requestError instanceof DOMException && requestError.name === "AbortError") return;
          setError(requestError instanceof Error ? requestError.message : "Araç alınamadı.");
        })
        .finally(() => setIsLoading(false));

      return () => {
        controller.abort();
        document.body.style.overflow = "";
      };
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, vehicleId]);

  if (!isOpen) return null;

  function update<K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/vehicles", {
        method: vehicleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vehicleId, vehicle: form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Araç kaydedilemedi.");

      const savedVehicle = data.vehicle as AdminVehicle;
      onSaved?.(savedVehicle);
      window.dispatchEvent(new CustomEvent("vehicle-admin-updated", { detail: savedVehicle.id }));
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Araç kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!vehicleId || !window.confirm("Bu aracı ve ilişkili yorum/favori verilerini kalıcı olarak silmek istiyor musun?")) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/vehicles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vehicleId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Araç silinemedi.");
      onDeleted?.(vehicleId);
      window.dispatchEvent(new CustomEvent("vehicle-admin-updated", { detail: vehicleId }));
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Araç silinemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">{vehicleId ? "Aracı düzenle" : "Yeni araç ekle"}</h2>
            <p className="mt-1 text-xs text-neutral-500">Pazar verisi, karar puanları ve kart içeriği aynı yerden güncellenir.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100" aria-label="Editörü kapat">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#014636]" /></div>
          ) : (
            <div className="space-y-6">
              {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

              <EditorSection title="Kimlik ve sınıf">
                {!vehicleId ? <TextField label="Kimlik" value={form.id} onChange={(value) => update("id", value)} placeholder="Boşsa otomatik oluşturulur" /> : null}
                <TextField label="Marka" value={form.make} onChange={(value) => update("make", value)} required />
                <TextField label="Model" value={form.model} onChange={(value) => update("model", value)} required />
                <TextField label="Paket / motor" value={form.trim_level} onChange={(value) => update("trim_level", value)} required />
                <TextField label="Segment" value={form.segment} onChange={(value) => update("segment", value)} required />
                <SelectField label="Gövde" value={form.body_type} options={["Hatchback", "Sedan", "Crossover", "SUV"]} onChange={(value) => update("body_type", value as VehicleDraft["body_type"])} />
                <SelectField label="Yakıt" value={form.fuel_type} options={["Benzin", "Dizel", "Hibrit", "Elektrik"]} onChange={(value) => update("fuel_type", value as VehicleDraft["fuel_type"])} />
                <SelectField label="Şanzıman" value={form.transmission} options={["Manuel", "Otomatik"]} onChange={(value) => update("transmission", value as VehicleDraft["transmission"])} />
              </EditorSection>

              <EditorSection title="Pazar aralığı">
                <NumberField label="Min. yıl" value={form.min_year} onChange={(value) => update("min_year", value)} />
                <NumberField label="Maks. yıl" value={form.max_year} onChange={(value) => update("max_year", value)} />
                <NumberField label="Min. km" value={form.min_km} onChange={(value) => update("min_km", value)} />
                <NumberField label="Maks. km" value={form.max_km} onChange={(value) => update("max_km", value)} />
                <NumberField label="Min. fiyat" value={form.market_min_price} onChange={(value) => update("market_min_price", value)} />
                <NumberField label="Maks. fiyat" value={form.market_max_price} onChange={(value) => update("market_max_price", value)} />
                <NumberField label="Yıllık gider" value={form.avg_annual_cost_try} onChange={(value) => update("avg_annual_cost_try", value)} />
                <NumberField label="Güç (hp)" value={form.power_hp} onChange={(value) => update("power_hp", value)} />
                <NumberField label="Koltuk" value={form.min_seats} onChange={(value) => update("min_seats", value)} />
                <NumberField label="Şehir içi lt/100 km" value={form.city_fuel_consumption ?? ""} step="0.1" onChange={(value) => update("city_fuel_consumption", value || null)} />
                <NumberField label="Şehir dışı lt/100 km" value={form.highway_fuel_consumption ?? ""} step="0.1" onChange={(value) => update("highway_fuel_consumption", value || null)} />
              </EditorSection>

              <EditorSection title="Kart içeriği" wide>
                <TextField label="Görsel URL" value={form.image_url ?? ""} onChange={(value) => update("image_url", value || null)} />
                <LongTextField label="Kondisyon özeti" value={form.condition_summary} onChange={(value) => update("condition_summary", value)} required />
                <ListField label="Etiketler" value={form.tags} onChange={(value) => update("tags", value)} />
                <ListField label="Neden öneriliyor?" value={form.why_listed} onChange={(value) => update("why_listed", value)} />
                <ListField label="Artılar" value={form.pros} onChange={(value) => update("pros", value)} />
                <ListField label="Eksiler" value={form.cons} onChange={(value) => update("cons", value)} />
              </EditorSection>

              <EditorSection title="Karar puanları">
                {scoreFields.map((field) => (
                  <NumberField key={field.key} label={field.label} value={form[field.key] as number} min={0} max={10} step="0.1" onChange={(value) => update(field.key, value as never)} />
                ))}
              </EditorSection>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {vehicleId ? (
              <button type="button" onClick={handleDelete} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> Sil
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">Vazgeç</button>
            <button type="submit" disabled={isLoading || isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white hover:bg-[#003a2d] disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Kaydet
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function EditorSection({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return <section><h3 className="mb-3 text-sm font-semibold text-[#014636]">{title}</h3><div className={wide ? "grid gap-3 md:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>{children}</div></section>;
}

function TextField({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <Field label={label}><input value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} className="editor-input" /></Field>;
}

function NumberField({ label, value, onChange, min = 0, max, step = "1" }: { label: string; value: number | string; onChange: (value: number) => void; min?: number; max?: number; step?: string }) {
  return <Field label={label}><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="editor-input" required /></Field>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className="editor-input">{options.map((option) => <option key={option}>{option}</option>)}</select></Field>;
}

function LongTextField({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <Field label={label}><textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="editor-input resize-y" /></Field>;
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <Field label={`${label} (satır başına bir madde)`}><textarea rows={4} value={value.join("\n")} onChange={(event) => onChange(event.target.value.split("\n"))} className="editor-input resize-y" /></Field>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-neutral-600"><span>{label}</span>{children}</label>;
}

function createEmptyVehicle(): VehicleDraft {
  const currentYear = new Date().getFullYear();
  return {
    id: "", make: "", model: "", trim_level: "", segment: "C", body_type: "Sedan",
    fuel_type: "Benzin", transmission: "Otomatik", min_seats: 5, power_hp: 100,
    min_year: currentYear - 3, max_year: currentYear, min_km: 0, max_km: 100000,
    market_min_price: 500000, market_max_price: 750000, avg_annual_cost_try: 50000,
    city_fuel_consumption: null, highway_fuel_consumption: null, condition_summary: "", image_url: null,
    tags: [], why_listed: [], pros: [], cons: [], safety_score: 5, efficiency_score: 5,
    family_score: 5, comfort_score: 5, performance_score: 5, youth_score: 5, resale_score: 5,
    city_score: 5, long_trip_score: 5, maintenance_score: 5, tech_score: 5,
  };
}
