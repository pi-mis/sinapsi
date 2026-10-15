import { supabase } from "@/integrations/supabase/client";
import { runLayout } from "./layout";
import type { GNode, GraphData } from "./data";
import { t, type Lang } from "@/i18n";
import { typeLabel } from "@/i18n/types";

const CLUSTERS: { type: string; items: [string, string][] }[] = [
  {
    type: "libro",
    items: [
      ["Il nome della rosa", "Eco usa il giallo per parlare di conoscenza proibita e biblioteche."],
      [
        "Le città invisibili",
        "Calvino: ogni città è un modo di guardare il desiderio e la memoria.",
      ],
      ["Se una notte d'inverno", "Il lettore come protagonista, romanzo fatto di inizi."],
      ["Lezioni americane", "Leggerezza, rapidità, esattezza, visibilità, molteplicità."],
      ["Il barone rampante", "Vivere sugli alberi come forma di libertà ostinata."],
      ["Borges, Finzioni", "La biblioteca di Babele: un universo fatto di libri."],
      ["Pensieri lenti e veloci", "Sistema 1 e sistema 2: intuizione contro ragionamento."],
      ["Sapiens", "Le finzioni condivise rendono possibile la cooperazione su larga scala."],
      ["Il piccolo principe", "L'essenziale è invisibile agli occhi."],
      [
        "Citazione di Calvino",
        "La leggerezza non è superficialità ma planare sulle cose dall'alto.",
      ],
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

/** The same demo notes in English, in the same order. */
const CLUSTERS_EN: [string, string][][] = [
  [
    [
      "The Name of the Rose",
      "Eco uses a murder mystery to talk about forbidden knowledge and libraries.",
    ],
    ["Invisible Cities", "Calvino: every city is a way of looking at desire and memory."],
    ["If on a Winter's Night a Traveller", "The reader as the hero, a novel made of beginnings."],
    [
      "Six Memos for the Next Millennium",
      "Lightness, quickness, exactitude, visibility, multiplicity.",
    ],
    ["The Baron in the Trees", "Living in the trees as a form of stubborn freedom."],
    ["Borges, Ficciones", "The Library of Babel: a universe made of books."],
    ["Thinking, Fast and Slow", "System 1 and System 2: intuition versus reasoning."],
    ["Sapiens", "Shared fictions make large-scale cooperation possible."],
    ["The Little Prince", "What is essential is invisible to the eye."],
    ["A Calvino quote", "Lightness isn't superficiality, it's gliding above things."],
  ],
  [
    ["Grandma's carbonara", "Guanciale, pecorino, egg yolks. Never cream."],
    ["Saffron risotto", "Toast the rice well, hot stock, stir in butter off the heat."],
    ["Slow-rise bread", "48 hours in the fridge, 75% hydration."],
    ["Pesto genovese", "Young basil, pine nuts, a marble mortar."],
    ["Tiramisu", "Ladyfingers, cold coffee, mascarpone whipped with yolks."],
    ["Sourdough starter", "Feed every 3 days, strong flour."],
    ["Sunday ragù", "Six hours of slow cooking, milk at the end."],
    ["Apulian focaccia", "Potatoes in the dough, cherry tomatoes and oregano."],
    ["Pistachio gelato", "Bronte pistachio paste, little sugar."],
    ["Idea: a spring dinner", "Asparagus, fresh peas, mint and lemon."],
  ],
  [
    ["Lisbon, August", "Tram 28 at sunset, pastéis de nata still warm."],
    ["Kyoto in autumn", "Red leaves at Tofuku-ji, silence in the temples."],
    ["Iceland by camper van", "Northern lights seen from a petrol station car park."],
    ["Path of the Gods", "From Bomerano to Nocelle, the sea under your feet."],
    ["Berlin 2019", "The Mauerpark flea market on Sundays."],
    ["Marrakech", "The souk at night, the smell of spices and leather."],
    ["Dolomites, mountain hut", "Sunrise over the Tre Cime, scalding tea."],
    ["Trip idea: Patagonia", "Torres del Paine in November, constant wind."],
    ["Naples with Dad", "Fried pizza and Spaccanapoli on foot."],
    ["Train to Edinburgh", "Northern coasts, reading, rain on the window."],
  ],
  [
    ["Digital brain", "A web app that connects notes by meaning."],
    ["Balcony vegetable garden", "Tomatoes, basil, drip irrigation."],
    ["Monthly newsletter", "One letter a month about books and ideas."],
    ["Bike restoration", "1970s steel frame, Campagnolo gears."],
    ["Podcast with Luca", "Conversations about design and slowness."],
    ["Learning Japanese", "Hiragana in two weeks, then basic kanji."],
    ["Photo exhibition", "Twenty prints on the theme of thresholds."],
    ["Grocery app", "A shared list that learns from habits."],
    ["Running a half marathon", "12-week plan, three runs a week."],
    ["Sorting the photo archive", "Tag by place and people."],
  ],
  [
    ["Wabi-sabi", "The beauty of the imperfect and the impermanent."],
    ["Stoicism", "Telling apart what depends on us from what doesn't."],
    ["Flow (Csikszentmihalyi)", "Challenge and skill in balance create absorption."],
    ["Memento mori", "Remembering death to live the present better."],
    ["Zeigarnik effect", "Unfinished tasks stay in mind more than finished ones."],
    ["Zettelkasten", "Atomic notes linked together make ideas emerge."],
    ["Antifragility", "Systems that get better thanks to shocks."],
    ["Ikigai", "What you love, what you're good at, what the world needs, what sustains you."],
    ["Map and territory", "The model isn't the reality it describes."],
    ["Idea: slowness as a method", "Slow down to see connections."],
  ],
  [
    ["Kind of Blue", "Miles Davis, modal, recorded with almost no rehearsal."],
    ["Ludovico Einaudi", "Minimalist piano, repetition and variation."],
    ["Bach, Goldberg Variations", "Gould 1955 versus Gould 1981."],
    ["Fabrizio De André", "La buona novella, the apocryphal Gospels set to music."],
    ["Brian Eno, Ambient 1", "Music for airports, listening without attention."],
    ["Radiohead, In Rainbows", "Released as pay-what-you-want."],
    ["Ryuichi Sakamoto", "async: found sounds, illness and time."],
    ["A night at the Arena", "Aida in summer, the stones still warm."],
    ["Playlist for writing", "Ambient, solo piano, no vocals."],
    ["Learning the guitar", "Open chords, then fingerstyle."],
  ],
];

/** Demo clusters with titles and texts in the requested language. */
function clusters(lang: Lang) {
  return CLUSTERS.map((c, ci) => ({
    type: c.type,
    items: lang === "en" ? CLUSTERS_EN[ci]! : c.items,
  }));
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Inserts 60 demo notes in 6 clusters with edges and a precomputed layout. */
export async function seedDemo(userId: string, lang: Lang) {
  const r = rand(42);
  const notes = clusters(lang).flatMap((c, ci) =>
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
      for (let m = 0; m < n; m++)
        add(i, c * 10 + Math.floor(r() * 10), 0.45 + r() * 0.5, kinds[Math.floor(r() * 4)]!);
    }
  }
  for (let m = 0; m < 14; m++)
    add(Math.floor(r() * 60), Math.floor(r() * 60), 0.35 + r() * 0.15, "semantic");

  const positions = await runLayout({
    nodes: notes.map((n) => ({ id: n.id })),
    links: edges.map((e) => ({ source: e.a, target: e.b, score: e.score })),
  });
  const rows = notes.map((n) => {
    const p = positions[n.id] ?? [0, 0, 0];
    return { ...n, pos_x: p[0], pos_y: p[1], pos_z: p[2] };
  });
  const { error } = await supabase.from("notes").insert(rows);
  if (error) throw new Error(t("Impossibile creare le note demo"));
  const { error: e2 } = await supabase.from("edges").insert(edges);
  if (e2) throw new Error(t("Impossibile creare le connessioni demo"));
}

export async function clearDemo() {
  const { error } = await supabase.from("notes").delete().eq("is_demo", true);
  if (error) throw new Error(t("Impossibile cancellare le note demo"));
}

/**
 * A purely local demo graph (no database): the demo notes arranged in six
 * constellations. Used as the living background of the login screen.
 */
export function buildDemoGraph(lang: Lang = "it"): GraphData {
  const r = rand(7);
  const CLUSTERS = clusters(lang);
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
  const hues = [0.48, 0.1, 0.72, 0.33, 0.93, 0.58];
  const nodes: GNode[] = CLUSTERS.flatMap((c, ci) => {
    const y = 1 - (2 * (ci + 0.5)) / CLUSTERS.length;
    const ring = Math.sqrt(1 - y * y);
    const t = ci * Math.PI * (3 - Math.sqrt(5));
    const center = [Math.cos(t) * ring * 3.2, y * 2.6, Math.sin(t) * ring * 3.2] as const;
    return c.items.map(([title], k) => ({
      id: `demo-${ci}-${k}`,
      title,
      type: c.type,
      weight: 0.15 + r() * 0.85,
      cluster: 100 + ci,
      hue: hues[ci]!,
      x: center[0] + gauss() * 0.75,
      y: center[1] + gauss() * 0.75,
      z: center[2] + gauss() * 0.75,
    }));
  });
  const edges: GraphData["edges"] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number, score: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, score, kind: "semantic" });
  };
  for (let c = 0; c < CLUSTERS.length; c++)
    for (let k = 0; k < 10; k++)
      for (let m = 0; m < 2 + Math.floor(r() * 2); m++)
        add(c * 10 + k, c * 10 + Math.floor(r() * 10), 0.4 + r() * 0.6);
  for (let m = 0; m < 12; m++) add(Math.floor(r() * 60), Math.floor(r() * 60), 0.2 + r() * 0.2);
  return {
    nodes,
    edges,
    demoCount: nodes.length,
    constellations: CLUSTERS.map((c, ci) => ({
      id: 100 + ci,
      label: typeLabel(c.type, lang),
      summary: null,
      hue: hues[ci]!,
      count: c.items.length,
    })),
  };
}
