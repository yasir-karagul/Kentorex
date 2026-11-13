import { create } from "zustand";
type Ui = { query: string; menuOpen: boolean; setQuery: (q: string) => void; setMenu: (o: boolean) => void };
export const useUi = create<Ui>((set) => ({ query: "", menuOpen: false, setQuery: (query) => set({ query }), setMenu: (menuOpen) => set({ menuOpen }) }));
