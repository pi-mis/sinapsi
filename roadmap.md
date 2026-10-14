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

# Fase 4 — Grafica
- [x] Shader dei neuroni (bordo luminoso, nucleo, respiro) con alone e bloom
- [x] Sinapsi curve con impulsi luminosi che viaggiano
- [ ] Sinapsi con spessore reale (oggi linee da 1px con bagliore)
- [x] Fluttuazione via GPU, polvere stellare, nomi delle costellazioni nello spazio
- [ ] Livelli di dettaglio per migliaia di note (nebulose → neuroni → etichette)
- [x] Versione mobile e accesso con password
