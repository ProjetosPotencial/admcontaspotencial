"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; label: string; href: string; papel_minimo: string; ativo: boolean; ordem: number };

const PAPEIS = ["leitura", "operador", "gestor", "admin"];

export default function MenuAdminClient({ itens: itensIniciais }: { itens: Item[] }) {
  const supabase = createClient();
  const [itens, setItens] = useState(itensIniciais);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function atualizar(id: string, campo: "papel_minimo" | "ativo", valor: string | boolean) {
    setSalvandoId(id);
    const { error } = await supabase.from("menu_itens").update({ [campo]: valor }).eq("id", id);
    setSalvandoId(null);
    if (error) { setAviso("Sem permissão para editar o menu."); return; }
    setItens((lista) => lista.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-[#f1f3f5] h-11">
            <th className="text-left text-[11.5px] font-semibold text-[#1a1a1a] px-4">Item</th>
            <th className="text-left text-[11.5px] font-semibold text-[#1a1a1a] px-4">Papel mínimo para ver</th>
            <th className="text-left text-[11.5px] font-semibold text-[#1a1a1a] px-4">Ativo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="h-12 border-b border-linha2 last:border-0">
              <td className="px-4 text-[13px] font-medium text-[#1a1a1a]">
                {item.label}
                <span className="block text-[11px] text-[#adb5bd] font-mono">{item.href}</span>
              </td>
              <td className="px-4">
                <select value={item.papel_minimo} disabled={salvandoId === item.id}
                  onChange={(e) => atualizar(item.id, "papel_minimo", e.target.value)}
                  className="border border-linha rounded-md px-2.5 py-1.5 text-[12.5px] capitalize disabled:opacity-50">
                  {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td className="px-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={item.ativo} disabled={salvandoId === item.id}
                    onChange={(e) => atualizar(item.id, "ativo", e.target.checked)}
                    className="w-4 h-4" />
                  <span className="text-[12.5px] text-[#6c757d]">{item.ativo ? "Visível" : "Escondido"}</span>
                </label>
              </td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr><td colSpan={3} className="text-center py-8 text-[#adb5bd] text-[13px]">Nenhum item cadastrado ainda.</td></tr>
          )}
        </tbody>
      </table></div>
      {aviso && <div className="px-4 py-2.5 text-[12px] text-alerr bg-alerr-bg">{aviso}</div>}
      <div className="px-4 py-2.5 text-[11px] text-[#adb5bd] border-t border-linha2">
        "Papel mínimo" significa: esse papel e os acima dele veem o item. Ex.: definir "gestor" esconde de operador e leitura, mas gestor e admin continuam vendo.
      </div>
    </div>
  );
}
