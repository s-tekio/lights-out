import '@testing-library/jest-dom/vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    length: 0,
    key: (): null => null,
  } satisfies Storage;
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
