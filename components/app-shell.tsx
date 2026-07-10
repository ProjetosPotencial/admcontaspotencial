"use client";

import { createContext, useContext, useState } from "react";

const MenuMobileContext = createContext<{ aberto: boolean; setAberto: (v: boolean) => void } | null>(null);

export function useMenuMobile() {
  const ctx = useContext(MenuMobileContext);
  if (!ctx) throw new Error("useMenuMobile precisa estar dentro de AppShell");
  return ctx;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <MenuMobileContext.Provider value={{ aberto, setAberto }}>
      <div className="min-h-screen flex bg-papel">{children}</div>
    </MenuMobileContext.Provider>
  );
}
