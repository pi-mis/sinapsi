/** Import centre: WhatsApp, contacts, calendars, GitHub. */
export const IMPORTS = {
  Contatti: "Contacts",
  Calendario: "Calendar",
  "Riempi il cervello": "Fill your brain",
  Chiudi: "Close",
  Fonte: "Source",
  "Lo zip non contiene la chat (.txt).": "The zip doesn't contain the chat (.txt).",
  "Non ho trovato messaggi: è un'esportazione di WhatsApp?":
    "I couldn't find any messages: is this a WhatsApp export?",
  "In WhatsApp apri la chat → nome in alto → **Esporta chat** → **Senza media**, e carica qui il file (.zip o .txt). Ogni conversazione diventa un neurone con la sua trascrizione, collegato alla persona o al gruppo.":
    "In WhatsApp open the chat → name at the top → **Export chat** → **Without media**, and upload the file here (.zip or .txt). Each conversation becomes a neuron with its transcript, linked to the person or group.",
  "Scegli un'altra chat": "Choose another chat",
  "Scegli la chat esportata": "Choose the exported chat",
  "{n} messaggi dal {from} al {to}": "{n} messages from {from} to {to}",
  "{n} conversazioni": "{n} conversations",
  "Nome della chat": "Chat name",
  "Tu chi sei nella chat?": "Which one are you in the chat?",
  "Scegli…": "Choose…",
  "{n} messaggi": "{n} messages",
  "Riassumi ogni conversazione con l'AI": "Summarise each conversation with AI",
  "I messaggi di ogni conversazione vengono inviati a Groq per il riassunto (circa {n} delle tue richieste AI di oggi). Contengono anche i messaggi degli altri: importa solo chat che ti senti di condividere così.":
    "Each conversation's messages are sent to Groq to be summarised (about {n} of today's AI requests). They include other people's messages too: only import chats you're comfortable sharing this way.",
  "Nessun messaggio lascia il dispositivo: le conversazioni diventano note private con la trascrizione.":
    "No message leaves your device: conversations become private notes with the transcript.",
  "{n} conversazioni importate": "{n} conversations imported",
  ", {n} già presenti": ", {n} already there",
  " ({n} senza riassunto AI)": " ({n} without AI summary)",
  "Importa {n} conversazioni": "Import {n} conversations",
  "Non ho trovato contatti nel file.": "I couldn't find any contacts in the file.",
  "Carica la rubrica come **vCard (.vcf)** — iPhone: app Contatti → Elenchi → tieni premuto → Esporta; Google Contatti: Esporta → vCard — oppure il file **Connections.csv** di LinkedIn (Impostazioni → Privacy dei dati → Ottieni una copia dei tuoi dati → Collegamenti).":
    "Upload your address book as **vCard (.vcf)** — iPhone: Contacts app → Lists → long-press → Export; Google Contacts: Export → vCard — or LinkedIn's **Connections.csv** file (Settings → Data privacy → Get a copy of your data → Connections).",
  "Le persone citate per nome e cognome nelle tue note diventano neuroni privati collegati a quelle note. I contatti non vengono mai inviati all'AI.":
    "People mentioned by first and last name in your notes become private neurons linked to those notes. Contacts are never sent to the AI.",
  "Scegli il file dei contatti": "Choose the contacts file",
  "{n} persone collegate alle note.": "{n} people linked to notes.",
  "Ricollega le persone": "Relink people",
  "{n} contatti trovati, ad esempio {names}.": "{n} contacts found, for example {names}.",
  "{n} contatti aggiunti": "{n} contacts added",
  " ({n} già presenti)": " ({n} already there)",
  "Importa {n} contatti": "Import {n} contacts",
  "Collega un calendario che si aggiorna da solo": "Connect a calendar that updates itself",
  "Google Calendar (dal computer): Impostazioni → il tuo calendario → **Indirizzo segreto in formato iCal**. Funziona anche con i calendari iCloud pubblici. Sinapsi lo controlla ogni 6 ore quando apri l'app, dai 2 mesi passati ai 12 futuri.":
    "Google Calendar (on a computer): Settings → your calendar → **Secret address in iCal format**. It also works with public iCloud calendars. Sinapsi checks it every 6 hours when you open the app, from 2 months back to 12 months ahead.",
  "È un link privato: chi lo possiede vede i tuoi eventi. Qui resta salvato solo nel tuo account.":
    "It's a private link: whoever has it sees your events. Here it's only saved in your account.",
  "Calendario collegato: {n} eventi salvati.": "Calendar connected: {n} events saved.",
  "Link iCal": "iCal link",
  Collega: "Connect",
  "Aggiornato {date}": "Updated {date}",
  "Mai aggiornato": "Never updated",
  "Aggiorna ora": "Update now",
  "{n} eventi aggiornati.": "{n} events updated.",
  "Scollega il calendario": "Disconnect the calendar",
  "Calendario scollegato (gli eventi già importati restano).":
    "Calendar disconnected (events already imported stay).",
  "Oppure importa un file .ics una volta sola": "Or import an .ics file just once",
  "Scegli il file .ics": "Choose the .ics file",
  "Non ho trovato eventi nel file.": "I couldn't find any events in the file.",
  "{n} eventi salvati": "{n} events saved",
  ", {n} esclusi (limite 1500)": ", {n} left out (limit 1500)",
  "Importa {n} eventi": "Import {n} events",
  "Gli eventi ricorrenti compaiono una sola volta, alla prima data.":
    "Recurring events appear only once, on their first date.",
  "{n} progetti aggiornati su {total}": "{n} of {total} projects updated",
  " (limite di GitHub raggiunto: il resto al prossimo aggiornamento)":
    " (GitHub limit reached: the rest at the next update)",
  "Ogni repository diventa un neurone **progetto** con descrizione, README e ultimi commit, collegato alle note che lo citano per nome. Si aggiorna da solo ogni 6 ore quando apri Sinapsi: vengono riletti solo i repository modificati.":
    "Each repository becomes a **project** neuron with its description, README and latest commits, linked to the notes that mention it by name. It updates itself every 6 hours when you open Sinapsi: only changed repositories are read again.",
  "GitHub collegato: {summary}": "GitHub connected: {summary}",
  "Utente GitHub": "GitHub user",
  "Il tuo utente GitHub (es. pi-mis)": "Your GitHub username (e.g. octocat)",
  "Includi i repository privati": "Include private repositories",
  "Serve un token in sola lettura: GitHub → Settings → Developer settings → Fine-grained tokens, accesso ai tuoi repository con permessi **Contents: read** e **Metadata: read**. I repository privati diventano note private, mai inviate all’AI. Il token resta salvato nel tuo account e non finisce nelle esportazioni.":
    "You need a read-only token: GitHub → Settings → Developer settings → Fine-grained tokens, with access to your repositories and the **Contents: read** and **Metadata: read** permissions. Private repositories become private notes, never sent to the AI. The token stays saved in your account and is never included in exports.",
  "Token GitHub": "GitHub token",
  "Collega GitHub": "Connect GitHub",
  " · anche privati": " · private too",
  "{n} progetti": "{n} projects",
  "aggiornato {date}": "updated {date}",
  "mai aggiornato": "never updated",
  "Scollega GitHub": "Disconnect GitHub",
  "GitHub scollegato (i progetti già importati restano).":
    "GitHub disconnected (projects already imported stay).",
} as const;
