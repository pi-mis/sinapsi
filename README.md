# Sinapsi

Un cervello digitale: note, ricordi e progetti come neuroni in uno spazio 3D, collegati per significato da un'AI che risponde solo usando la tua memoria.

## AI

- Embeddings calcolati nel browser (Transformers.js, `multilingual-e5-small`): gratuiti e senza inviare testo a terzi.
- Risposte, nomi delle costellazioni e spiegazioni dei collegamenti via [Groq](https://console.groq.com) con modelli open-weight. Serve il secret `GROQ_API_KEY_SINAPSI` (in Lovable Cloud e, per lo sviluppo locale, in un file `.env.local` non versionato).
- Le note private non vengono mai inviate a Groq.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/989f80a4-91ea-4a81-ae36-ac10b509732b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
