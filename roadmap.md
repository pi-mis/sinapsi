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

# Fase 4 — Grafica
- [ ] Shader dei neuroni (fresnel, membrana, nucleo luminoso) e bloom selettivo
- [ ] Sinapsi curve con spessore reale e impulsi luminosi
- [ ] Fluttuazione via GPU e livelli di dettaglio (nebulose → neuroni → etichette)
