/** Messages and AI fallbacks from the server. */
export const SERVER = {
  "AI non disponibile.": "AI not available.",
  "Risposta AI non valida.": "Invalid AI response.",
  "Il calendario non risponde.": "The calendar isn't responding.",
  "Il calendario non è raggiungibile: controlla il link.":
    "The calendar can't be reached: check the link.",
  "Il link non contiene un calendario iCal.": "The link doesn't contain an iCal calendar.",
  "Impossibile leggere le due note.": "Couldn't read the two notes.",
  "Collegamento trovato sul tuo dispositivo: una delle due note è privata, quindi l'AI non la legge.":
    "Connection found on your device: one of the two notes is private, so the AI doesn't read it.",
  "Questa settimana non ci sono ancora abbastanza note per un riepilogo.":
    "There aren't enough notes this week for a summary yet.",
  nota: "note",
  Nota: "Note",
  "L'AI non è configurata: manca il secret GROQ_API_KEY_SINAPSI.":
    "The AI isn't configured: the GROQ_API_KEY_SINAPSI secret is missing.",
  "Hai raggiunto il limite di {cap} richieste AI per oggi.":
    "You've reached today's limit of {cap} AI requests.",
  "La chiave Groq non è valida.": "The Groq key isn't valid.",
  "Limite gratuito di Groq raggiunto per ora: riprova tra qualche minuto.":
    "Groq's free limit reached for now: try again in a few minutes.",
  "Groq non risponde in questo momento.": "Groq isn't responding right now.",
  "L'AI non ha restituito una risposta.": "The AI didn't return an answer.",
  "Trascrizione non riuscita.": "Transcription failed.",
  "La ricerca sul web non ha risposto in tempo.": "The web search didn't answer in time.",
  "Ricerca sul web non disponibile con questa chiave Groq.":
    "Web search isn't available with this Groq key.",
  "Archivio dei file non disponibile.": "File storage isn't available.",
  "Impossibile preparare il caricamento.": "Couldn't prepare the upload.",
  "Impossibile aprire gli allegati.": "Couldn't open the attachments.",
  "Il link non è valido.": "The link isn't valid.",
  "Questo link non si può aprire.": "This link can't be opened.",
  "Ricerca semantica non disponibile.": "Semantic search isn't available.",
  "Nella tua memoria non c’è ancora niente su questo.":
    "There's nothing about this in your memory yet.",
  "Impossibile leggere le note trovate.": "Couldn't read the notes found.",
  "Ho trovato solo note private: te le mostro qui sotto, ma l’AI non le legge.":
    "I only found private notes: they're listed below, but the AI doesn't read them.",
  "Nota non trovata.": "Note not found.",
  "File troppo grande: il limite è 25 MB.": "File too large: the limit is 25 MB.",
  "Percorso del file non valido.": "Invalid file path.",
  "Impossibile salvare l'allegato.": "Couldn't save the attachment.",
  "Allegato non trovato.": "Attachment not found.",
  "Allegato non raggiungibile.": "Attachment not reachable.",
  "Analisi non riuscita.": "Analysis failed.",
  "Impossibile salvare il link.": "Couldn't save the link.",
  "Impossibile eliminare l'allegato.": "Couldn't delete the attachment.",
  "Non hai accesso a questa pagina.": "You don't have access to this page.",
  "Impossibile leggere gli utenti.": "Couldn't read the users.",
} as const;
