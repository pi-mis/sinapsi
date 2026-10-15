# Fase 2
- [x] Grafo nitido, navigazione stabile e controlli di vista
- [x] Cattura, modifica, eliminazione, elenco e timeline delle note
- [x] Ricerca testuale in basso e ricerca AI (100 note non private più recenti; ricerca vettoriale nelle fasi successive)
- [x] Esportazione ZIP e importazione con verifica dei dati e ripristino transazionale
- [x] Verifica con note reali, ciclo modifica/elimina/ripristina, ricerca AI e viste desktop/mobile

# Fase 3 — Strato semantico
- [x] AI generativa su Groq (modelli open-weight, piano gratuito) al posto di Lovable AI
- [x] Embeddings calcolati nel browser (multilingual-e5-small), anche per le note private
- [x] Sinapsi semantiche automatiche con forza e spiegazione AI su richiesta ("Perché?")
- [x] Costellazioni automatiche (k-means), nominate dall'AI, colore per costellazione e legenda
- [x] Dimensione del neurone in base al contenuto
- [x] Chat RAG: risponde solo dalla memoria, con citazioni
- [ ] Verifica con note reali e taratura delle soglie in `src/ai/config.ts`

# Fase 5 — Neuroni ricchi
- [x] Allegati in storage privato: file, foto, PDF, testi, vocali registrati dall'app, link
- [x] PDF e testi letti nel browser; foto descritte e vocali trascritti da Groq; link riassunti
- [x] Il testo degli allegati entra in ricerca, embeddings, sinapsi e chat
- [ ] Gli allegati nell'esportazione ZIP (oggi esporta solo i metadati e il testo estratto)

# Fase 6 — Il cervello si riempie da solo
- [x] Import chat WhatsApp (.txt/.zip): una nota per conversazione, trascrizione, riassunto AI opzionale
- [x] Rubrica (vCard) e LinkedIn (Connections.csv): le persone citate nelle note diventano neuroni
- [x] Calendario: file .ics o link iCal segreto che si aggiorna da solo
- [ ] Email (inoltro a un indirizzo dedicato; Gmail richiede la verifica di Google)
- [ ] Foto e media dentro gli export di WhatsApp

# Fase 7 — Il cervello che lavora in parallelo
- [x] Le note vengono lette per intenzioni e scadenze → promemoria
- [x] Se la scadenza manca, l'AI la cerca sul web e salva la fonte
- [x] Impegni delle chat WhatsApp → promemoria
- [x] Pannello promemoria, campanella con badge, notifica nel browser
- [x] Calendario privato dei promemoria da aggiungere al telefono (notifiche native)
- [x] Riepilogo settimanale "La tua settimana"
- [x] Chat AI a più turni per il brainstorming
- [x] Connettore GitHub: i repository diventano progetti e si aggiornano da soli
- [ ] Notifiche push e Telegram anche ad app chiusa (serve un job programmato)
- [ ] Altri connettori: Notion, Google Drive, email

# Fase 4 e 8 — Grafica e scala
- [x] Shader dei neuroni (bordo luminoso, nucleo, respiro) con alone e bloom
- [x] Sinapsi curve con impulsi luminosi che viaggiano
- [x] Sinapsi con spessore reale (nastri che restano nitidi a ogni zoom)
- [x] Fluttuazione via GPU, polvere stellare, nomi delle costellazioni nello spazio
- [x] Livelli di dettaglio per migliaia di note (nebulose → neuroni → etichette dei neuroni vicini)
- [x] Luce adattiva alla densità: leggibile anche con 2000+ neuroni
- [x] App installabile e consultabile offline (ultima copia salvata)
- [x] Versione mobile e accesso con password

# Accoglienza e amministrazione
- [x] Verifica dell'email al primo accesso (solo indirizzi reali)
- [x] Animazione di benvenuto: cosa ci metti dentro, a cosa serve, connettori e GitHub; alla fine si esce dalla demo
- [x] "Rivedi l'introduzione" dal menu ⋯
- [x] Pagina /admin per gli amministratori: utenti registrati, email verificate, note, collegamenti e uso dell'AI (solo conteggi)
- [x] Italiano e inglese: lingua scelta in base al dispositivo o alla connessione, modificabile all'inizio dell'introduzione e dal menu; anche l'AI risponde nella lingua scelta
