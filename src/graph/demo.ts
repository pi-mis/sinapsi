import { supabase } from "@/integrations/supabase/client";
import { runLayout } from "./layout";

const CLUSTERS: { type: string; items: [string, string][] }[] = [
  {
    type: "libro",
    items: [
      ["Il nome della rosa", "Eco usa il giallo per parlare di conoscenza proibita e biblioteche."],
      ["Le città invisibili", "Calvino: ogni città è un modo di guardare il desiderio e la memoria."],
      ["Se una notte d'inverno", "Il lettore come protagonista, romanzo fatto di inizi."],
      ["Lezioni americane", "Leggerezza, rapidità, esattezza, visibilità, molteplicità."],
      ["Il barone rampante", "Vivere sugli alberi come forma di libertà ostinata."],
      ["Borges, Finzioni", "La biblioteca di Babele: un universo fatto di libri."],
      ["Pensieri lenti e veloci", "Sistema 1 e sistema 2: intuizione contro ragionamento."],
      ["Sapiens", "Le finzioni condivise rendono possibile la cooperazione su larga scala."],
      ["Il piccolo principe", "L'essenziale è invisibile agli occhi."],
      ["Citazione di Calvino", "La leggerezza non è superficialità ma planare sulle cose dall'alto."],
    ],
  },
  {
    type: "ricetta",
    items: [
      ["Carbonara della nonna", "Guanciale, pecorino, tuorli. Mai la panna."],
      ["Risotto allo zafferano", "Tostare bene il riso, brodo caldo, mantecare a fuoco spento."],
      ["Pane a lievitazione lenta", "48 ore in frigo, idratazione al 75%."],
      ["Pesto alla genovese", "Basilico giovane, pinoli, mortaio di marmo."],
      ["Tiramisù", "Savoiardi, caffè freddo, mascarpone montato con tuorli."],
      ["Lievito madre", "Rinfresco ogni 3 giorni, farina di forza."],
      ["Ragù della domenica", "Sei ore di cottura lenta, latte alla fine."],
      ["Focaccia pugliese", "Patate nell'impasto, pomodorini e origano."],
      ["Gelato al pistacchio", "Pasta di pistacchio di Bronte, poco zucchero."],
      ["Idea: cena di primavera", "Asparagi, piselli freschi, menta e limone."],
    ],
  },
  {
    type: "ricordo",
    items: [
      ["Lisbona, agosto", "Tram 28 al tramonto, pastéis de nata ancora caldi."],
      ["Kyoto in autunno", "Foglie rosse al Tofuku-ji, silenzio nei templi."],
      ["Islanda in camper", "Aurora boreale vista dal parcheggio di un benzinaio."],
      ["Sentiero degli Dei", "Da Bomerano a Nocelle, il mare sotto i piedi."],
      ["Berlino 2019", "Mercatino di Mauerpark la domenica."],
      ["Marrakech", "Il souk di notte, odore di spezie e cuoio."],
      ["Dolomiti, rifugio", "Alba sulle Tre Cime, tè bollente."],
      ["Idea viaggio: Patagonia", "Torres del Paine a novembre, vento costante."],
      ["Napoli con papà", "Pizza fritta e Spaccanapoli a piedi."],
      ["Treno per Edimburgo", "Coste del nord, lettura e pioggia sul finestrino."],
    ],
  },
  {
    type: "progetto",
    items: [
      ["Cervello digitale", "Webapp per collegare note per significato."],
      ["Orto sul balcone", "Pomodori, basilico, irrigazione a goccia."],
      ["Newsletter mensile", "Una lettera al mese su libri e idee."],
      ["Restauro bicicletta", "Telaio in acciaio anni '70, cambio Campagnolo."],
      ["Podcast con Luca", "Conversazioni su design e lentezza."],
      ["Imparare il giapponese", "Hiragana in due settimane, poi kanji base."],
      ["Mostra fotografica", "Venti stampe sul tema delle soglie."],
      ["App per la spesa", "Lista condivisa che impara dalle abitudini."],
      ["Correre la mezza", "Piano di 12 settimane, tre uscite a settimana."],
      ["Riordinare l'archivio foto", "Taggare per luogo e persone."],
    ],
  },
  {
    type: "concetto",
    items: [
      ["Wabi-sabi", "Bellezza dell'imperfetto e dell'impermanente."],
      ["Stoicismo", "Distinguere ciò che dipende da noi da ciò che non dipende."],
      ["Flusso (Csikszentmihalyi)", "Sfida e abilità in equilibrio generano assorbimento."],
      ["Memento mori", "Ricordare la morte per vivere meglio il presente."],
      ["Effetto Zeigarnik", "Le attività incomplete restano in mente più di quelle finite."],
      ["Zettelkasten", "Note atomiche collegate tra loro fanno emergere idee."],
      ["Antifragilità", "Sistemi che migliorano grazie agli shock."],
      ["Ikigai", "Ciò che ami, sai fare, serve al mondo e ti sostiene."],
      ["Mappa e territorio", "Il modello non è la realtà che descrive."],
      ["Idea: la lentezza come metodo", "Rallentare per vedere connessioni."],
    ],
  },
  {
    type: "musica",
    items: [
      ["Kind of Blue", "Miles Davis, modale, registrato quasi senza prove."],
      ["Ludovico Einaudi", "Minimalismo pianistico, ripetizione e variazione."],
      ["Bach, Variazioni Goldberg", "Gould 1955 contro Gould 1981."],
      ["Fabrizio De André", "La buona novella, Vangeli apocrifi in musica."],
      ["Brian Eno, Ambient 1", "Musica per aeroporti, ascolto non attento."],
      ["Radiohead, In Rainbows", "Pubblicato a offerta libera."],
      ["Ryuichi Sakamoto", "async: suoni trovati, malattia e tempo."],
      ["Concerto all'Arena", "Aida d'estate, pietre ancora calde."],
      ["Playlist per scrivere", "Ambient, piano solo, niente voci."],
      ["Imparare la chitarra", "Accordi aperti, poi fingerstyle."],
    ],
  },
];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Inserts 60 demo notes in 6 clusters with edges and a precomputed layout. */
export async function seedDemo(userId: string) {
  const r = rand(42);
  const notes = CLUSTERS.flatMap((c, ci) =>
    c.items.map(([title, content]) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      content,
      type: c.type,
      is_demo: true,
      ai_status: "done",
      cluster_id: ci,
      weight: 0.15 + r() * 0.85,
    })),
  );
  const kinds = ["semantic", "semantic", "tag", "entity"];
  const seen = new Set<string>();
  const edges: { user_id: string; a: string; b: string; score: number; kind: string }[] = [];
  const add = (i: number, j: number, score: number, kind: string) => {
    if (i === j) return;
    const [a, b] = i < j ? [i, j] : [j, i];
    const key = `${a}-${b}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ user_id: userId, a: notes[a]!.id, b: notes[b]!.id, score, kind });
  };
  for (let c = 0; c < 6; c++) {
    for (let k = 0; k < 10; k++) {
      const i = c * 10 + k;
      const n = 2 + Math.floor(r() * 3);
      for (let m = 0; m < n; m++) add(i, c * 10 + Math.floor(r() * 10), 0.45 + r() * 0.5, kinds[Math.floor(r() * 4)]!);
    }
  }
  for (let m = 0; m < 14; m++) add(Math.floor(r() * 60), Math.floor(r() * 60), 0.35 + r() * 0.15, "semantic");

  const positions = await runLayout({
    nodes: notes.map((n) => ({ id: n.id })),
    links: edges.map((e) => ({ source: e.a, target: e.b, score: e.score })),
  });
  const rows = notes.map((n) => {
    const p = positions[n.id] ?? [0, 0, 0];
    return { ...n, pos_x: p[0], pos_y: p[1], pos_z: p[2] };
  });
  const { error } = await supabase.from("notes").insert(rows);
  if (error) throw new Error("Impossibile creare le note demo");
  const { error: e2 } = await supabase.from("edges").insert(edges);
  if (e2) throw new Error("Impossibile creare le connessioni demo");
}

export async function clearDemo() {
  const { error } = await supabase.from("notes").delete().eq("is_demo", true);
  if (error) throw new Error("Impossibile cancellare le note demo");
}
