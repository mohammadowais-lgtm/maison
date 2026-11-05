import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { tagItem, suggestOutfit } from "@/lib/stylist.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison — Your Personal AI Stylist" },
      { name: "description", content: "Upload your wardrobe and receive a curated outfit every day — casual, party, traditional or formal." },
      { property: "og:title", content: "Maison — Your Personal AI Stylist" },
      { property: "og:description", content: "Upload your wardrobe and receive a curated outfit every day." },
    ],
  }),
  component: Index,
});

type Item = { id: string; name: string; category: string; color: string; styles: string[]; image: string; pending?: boolean };
type Look = { title: string; itemIds: string[]; why: string; tip: string };

const OCCASIONS = [
  { key: "casual", label: "Casual", sub: "Effortless everyday" },
  { key: "party", label: "Party", sub: "Evening glamour" },
  { key: "traditional", label: "Traditional", sub: "Heritage & festive" },
  { key: "formal", label: "Formal", sub: "Office & occasions" },
  { key: "sporty", label: "Sporty", sub: "Active & athleisure" },
];
const STORE = "maison-wardrobe-v1";

function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 448;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * s;
      c.height = img.height * s;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function Index() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [occasion, setOccasion] = useState("casual");
  const [note, setNote] = useState("");
  const [look, setLook] = useState<Look | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const tag = useServerFn(tagItem);
  const suggest = useServerFn(suggestOutfit);

  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem(STORE) || "[]").filter((i: Item) => !i.pending)); } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE, JSON.stringify(items.filter((i) => !i.pending))); } catch { setError("Your device storage is full — remove a few pieces."); }
  }, [items, loaded]);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const image = await compress(f);
      const id = crypto.randomUUID();
      setItems((p) => [{ id, image, name: "Reading the fabric…", category: "", color: "", styles: [], pending: true }, ...p]);
      tag({ data: { image } })
        .then((t) => setItems((p) => p.map((i) => (i.id === id ? { ...i, ...t, pending: false } : i))))
        .catch((e) => {
          setItems((p) => p.filter((i) => i.id !== id));
          setError(e.message);
        });
    }
  }

  async function curate() {
    const ready = items.filter((i) => !i.pending);
    if (!ready.length) return setError("Add a few pieces to your wardrobe first.");
    setBusy(true); setError(null); setLook(null);
    const ranked = [...ready].sort((a, b) => Number(b.styles.includes(occasion)) - Number(a.styles.includes(occasion))).slice(0, 40);
    try {
      const label = OCCASIONS.find((o) => o.key === occasion)?.label ?? occasion;
      setLook(await suggest({ data: { occasion: `${label} wear, today ${new Date().toDateString()}`, note, items: ranked } }));
      setTimeout(() => document.getElementById("look")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const shown = items.filter((i) => filter === "all" || i.category === filter);
  const cats = ["all", ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))];
  const lookItems = look ? look.itemIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as Item[] : [];

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      <header className="flex items-center justify-between py-8 rise">
        <span className="font-display text-2xl tracking-[0.4em] text-gold-gradient">MAISON</span>
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
      </header>

      <section className="py-16 text-center md:py-24">
        <p className="rise text-xs uppercase tracking-[0.5em] text-primary">Your private atelier</p>
        <h1 className="rise mt-6 font-display text-5xl leading-tight md:text-7xl" style={{ animationDelay: "0.15s" }}>
          Dressed with <em className="text-gold-gradient">intention</em>,<br />every single day.
        </h1>
        <p className="rise mx-auto mt-6 max-w-lg text-muted-foreground" style={{ animationDelay: "0.3s" }}>
          Upload your pieces. Choose the mood. Your stylist composes the finest look from your own wardrobe.
        </p>
      </section>

      <section className="rise" style={{ animationDelay: "0.45s" }}>
        <h2 className="mb-6 text-center font-display text-3xl">What's the occasion?</h2>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1 md:flex-wrap md:justify-center md:mx-0 md:px-0">
          {OCCASIONS.map((o) => {
            const active = occasion === o.key;
            return (
              <button key={o.key} onClick={() => setOccasion(o.key)}
                className={`shrink-0 rounded-full border px-6 py-3 transition-all duration-300 ${active ? "border-primary bg-accent shadow-glow" : "border-border bg-card/70 text-muted-foreground hover:border-primary/60 hover:text-foreground"}`}>
                <span className="font-display text-lg">{o.label}</span>
                {active && <span className="ml-3 text-xs text-primary">{o.sub}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
            placeholder="Any wishes? e.g. rooftop dinner, rainy day, wedding sangeet…"
            className="flex-1 rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none transition focus:border-primary" />
          <button onClick={curate} disabled={busy}
            className="bg-gold-gradient rounded-lg px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground shadow-glow transition hover:scale-[1.02] disabled:opacity-60">
            {busy ? "Curating…" : "Style me"}
          </button>
        </div>
        {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
      </section>

      {busy && (
        <div className="mt-16 flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-14 w-14 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="font-display text-xl italic">Your stylist is composing a look…</p>
        </div>
      )}

      {look && (
        <section id="look" className="mt-20 rounded-xl border bg-card p-8 shadow-glow md:p-12">
          <p className="rise text-xs uppercase tracking-[0.5em] text-primary">Today's look</p>
          <h2 className="rise mt-3 font-display text-4xl md:text-5xl">{look.title}</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {lookItems.map((it, i) => (
              <figure key={it.id} className="rise" style={{ animationDelay: `${0.15 * i + 0.2}s` }}>
                <div className="float-slow overflow-hidden rounded-lg border" style={{ animationDelay: `${i * 0.8}s` }}>
                  <img src={it.image} alt={it.name} className="aspect-[3/4] w-full object-cover" />
                </div>
                <figcaption className="mt-2 text-sm">{it.name}</figcaption>
              </figure>
            ))}
          </div>
          <p className="rise mt-8 max-w-2xl font-display text-xl leading-relaxed" style={{ animationDelay: "0.6s" }}>{look.why}</p>
          <p className="rise mt-4 text-sm text-muted-foreground" style={{ animationDelay: "0.75s" }}><span className="text-primary">Stylist's note — </span>{look.tip}</p>
        </section>
      )}

      <section className="mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-4xl">The Wardrobe</h2>
            <p className="text-sm text-muted-foreground">{items.length} pieces · sorted automatically</p>
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-primary px-6 py-3 text-xs uppercase tracking-[0.25em] text-primary transition hover:bg-primary hover:text-primary-foreground">
            + Add pieces
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {cats.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c} onClick={() => setFilter(c)}
                className={`rounded-full border px-4 py-1 text-xs capitalize transition ${filter === c ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary"}`}>{c}</button>
            ))}
          </div>
        )}
        {items.length === 0 ? (
          <button onClick={() => fileRef.current?.click()}
            className="mt-8 flex w-full flex-col items-center justify-center rounded-xl border border-dashed py-20 text-muted-foreground transition hover:border-primary hover:text-foreground">
            <span className="font-display text-3xl">Begin your collection</span>
            <span className="mt-2 text-sm">Upload photos of your clothes, shoes & accessories</span>
          </button>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {shown.map((it, i) => (
              <div key={it.id} className="group rise relative" style={{ animationDelay: `${Math.min(i, 10) * 0.05}s` }}>
                <div className="overflow-hidden rounded-lg border bg-card">
                  <img src={it.image} alt={it.name} className={`aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-105 ${it.pending ? "animate-pulse opacity-50" : ""}`} />
                </div>
                <p className="mt-2 truncate text-sm">{it.name}</p>
                {!it.pending && <p className="text-xs capitalize text-muted-foreground">{it.category} · {it.styles.join(", ")}</p>}
                {!it.pending && (
                  <button onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} aria-label="Remove"
                    className="absolute right-2 top-2 rounded-full bg-background/80 px-2 text-sm opacity-0 transition group-hover:opacity-100">×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
