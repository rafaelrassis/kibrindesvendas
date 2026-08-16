"use client";

/**
 * Store mínima em cima do `localStorage` para uso com `useSyncExternalStore`.
 *
 * Guarda em cache o último conteúdo bruto lido para que a leitura devolva
 * sempre a mesma referência enquanto o valor armazenado não mudar — requisito
 * do `useSyncExternalStore`, que compara os snapshots por identidade.
 */
export function criarStoreLocal<T>(
  chave: string,
  converter: (bruto: string | null) => T
) {
  const ouvintes = new Set<() => void>();
  const valorVazio = converter(null);

  let brutoEmCache: string | null = null;
  let valorEmCache: T = valorVazio;
  let jaLeu = false;

  return {
    inscrever(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      // Mantém as abas em sincronia: o evento `storage` só dispara nas outras.
      window.addEventListener("storage", ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
        window.removeEventListener("storage", ouvinte);
      };
    },

    ler(): T {
      const bruto = window.localStorage.getItem(chave);
      if (jaLeu && bruto === brutoEmCache) return valorEmCache;
      brutoEmCache = bruto;
      valorEmCache = converter(bruto);
      jaLeu = true;
      return valorEmCache;
    },

    lerNoServidor(): T {
      return valorVazio;
    },

    escrever(bruto: string | null) {
      if (bruto === null) {
        window.localStorage.removeItem(chave);
      } else {
        window.localStorage.setItem(chave, bruto);
      }
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
}
