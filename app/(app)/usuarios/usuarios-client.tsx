"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS } from "@/lib/types";

const PAPEL_LABEL: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-alerr-bg text-alerr" },
  gestor: { label: "Gestor", cls: "bg-info-bg text-info" },
  operador: { label: "Operador", cls: "bg-ok-bg text-ok" },
  leitura: { label: "Leitura", cls: "bg-[#f1f3f5] text-[#adb5bd]" },
};
const PAPEIS = ["leitura", "operador", "gestor", "admin"];
const RANK: Record<string, number> = { leitura: 0, operador: 1, gestor: 2, admin: 3 };

type Usuario = { id: string; nome: string; email: string; papel: string; ativo: boolean; tipos_permitidos?: string[] | null };

/** Os tipos reais do sistema — sair desta lista é criar conta órfã. */
const TIPOS_LISTA = Object.entries(TIPOS).map(([valor, t]) => ({ valor, rotulo: t.n }));
type MenuItem = { id: string; label: string; papel_minimo: string; ordem: number };
type Override = { perfil_id: string; menu_item_id: string; permitido: boolean };

export default function UsuariosClient({
  usuarios: iniciais, ehAdmin, meuId, menuItens = [], overrides: overridesIniciais = [],
}: {
  usuarios: Usuario[]; ehAdmin: boolean; meuId: string; menuItens?: MenuItem[]; overrides?: Override[];
}) {
  const supabase = createClient();
  const [usuarios, setUsuarios] = useState(iniciais);
  const [overrides, setOverrides] = useState<Override[]>(overridesIniciais);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [menuUser, setMenuUser] = useState<Usuario | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [salvandoMenu, setSalvandoMenu] = useState(false);

  // criar novo usuário
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoPapel, setNovoPapel] = useState("leitura");
  const [novoChecks, setNovoChecks] = useState<Record<string, boolean>>({});
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  const padraoDoPapel = (item: MenuItem, papel: string) => (RANK[item.papel_minimo] ?? 0) <= (RANK[papel] ?? 0);

  function defaultsPara(papel: string): Record<string, boolean> {
    const c: Record<string, boolean> = {};
    for (const it of menuItens) c[it.id] = padraoDoPapel(it, papel);
    return c;
  }

  function abrirCriar() {
    setNovoNome(""); setNovoEmail(""); setNovaSenha(""); setNovoPapel("leitura");
    setNovoChecks(defaultsPara("leitura")); setErroNovo(null); setCriando(true);
  }

  function trocarPapelNovo(papel: string) {
    setNovoPapel(papel);
    setNovoChecks(defaultsPara(papel));
  }

  async function criarUsuario() {
    setSalvandoNovo(true); setErroNovo(null);
    const desvios = menuItens
      .filter((it) => novoChecks[it.id] !== padraoDoPapel(it, novoPapel))
      .map((it) => ({ menu_item_id: it.id, permitido: !!novoChecks[it.id] }));
    const resp = await fetch("/api/usuarios/criar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome, email: novoEmail, senha: novaSenha, papel: novoPapel, overrides: desvios }),
    });
    const json = await resp.json().catch(() => ({}));
    setSalvandoNovo(false);
    if (!resp.ok) { setErroNovo(json.error ?? "Não foi possível criar o usuário."); return; }
    setUsuarios((prev) => [...prev, { id: json.id, nome: json.nome, email: json.email, papel: json.papel, ativo: true }]
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")));
    setOverrides((prev) => [...prev, ...desvios.map((d) => ({ perfil_id: json.id, ...d }))]);
    setCriando(false);
  }

  async function mudarPapel(id: string, novoPapel: string) {
    if (id === meuId && novoPapel !== "admin") {
      setAviso("Você não pode rebaixar o próprio papel por aqui — peça pra outro admin fazer isso.");
      return;
    }
    setSalvandoId(id); setAviso(null);
    const { error } = await supabase.from("perfis").update({ papel: novoPapel }).eq("id", id);
    setSalvandoId(null);
    if (error) { setAviso("Sem permissão para alterar este usuário."); return; }
    setUsuarios((lista) => lista.map((u) => (u.id === id ? { ...u, papel: novoPapel } : u)));
  }

  const [editandoTipos, setEditandoTipos] = useState<Usuario | null>(null);
  const [tiposMarcados, setTiposMarcados] = useState<string[]>([]);
  const [todosTipos, setTodosTipos] = useState(true);

  function abrirTipos(u: Usuario) {
    setEditandoTipos(u);
    setTodosTipos(!u.tipos_permitidos);
    setTiposMarcados(u.tipos_permitidos ?? []);
  }

  async function salvarTipos() {
    if (!editandoTipos) return;
    // null = vê todos. É a mesma convenção que a função pode_ver_tipo() usa
    // no banco; se os dois lados discordassem, a tela mostraria uma coisa e
    // a RLS entregaria outra.
    const valor = todosTipos ? null : tiposMarcados;

    if (!todosTipos && tiposMarcados.length === 0) {
      setAviso("Marque ao menos um tipo, ou deixe em Todos — sem nenhum, a pessoa não enxerga conta alguma.");
      return;
    }

    setSalvandoId(editandoTipos.id);
    const { error } = await supabase.from("perfis").update({ tipos_permitidos: valor }).eq("id", editandoTipos.id);
    setSalvandoId(null);
    if (error) { setAviso("Não foi possível salvar os tipos: " + error.message); return; }

    setUsuarios((lista) => lista.map((u) => (u.id === editandoTipos.id ? { ...u, tipos_permitidos: valor } : u)));
    setEditandoTipos(null);
  }

  async function mudarAtivo(id: string, ativo: boolean) {
    setSalvandoId(id);
    const { error } = await supabase.from("perfis").update({ ativo }).eq("id", id);
    setSalvandoId(null);
    if (error) { setAviso("Sem permissão para alterar este usuário."); return; }
    setUsuarios((lista) => lista.map((u) => (u.id === id ? { ...u, ativo } : u)));
  }

  function abrirMenus(u: Usuario) {
    const meus = new Map(overrides.filter((o) => o.perfil_id === u.id).map((o) => [o.menu_item_id, o.permitido]));
    const c: Record<string, boolean> = {};
    for (const item of menuItens) c[item.id] = meus.has(item.id) ? meus.get(item.id)! : padraoDoPapel(item, u.papel);
    setChecks(c); setMenuUser(u); setAviso(null);
  }

  async function salvarMenus() {
    if (!menuUser) return;
    setSalvandoMenu(true);
    const u = menuUser;
    const desvios: Override[] = menuItens
      .filter((it) => checks[it.id] !== padraoDoPapel(it, u.papel))
      .map((it) => ({ perfil_id: u.id, menu_item_id: it.id, permitido: !!checks[it.id] }));

    const del = await supabase.from("perfil_menu").delete().eq("perfil_id", u.id);
    if (del.error) { setSalvandoMenu(false); setAviso("Sem permissão para alterar menus (só admin)."); return; }
    if (desvios.length) {
      const ins = await supabase.from("perfil_menu").insert(desvios);
      if (ins.error) { setSalvandoMenu(false); setAviso("Não foi possível salvar os menus."); return; }
    }
    setOverrides((prev) => [...prev.filter((o) => o.perfil_id !== u.id), ...desvios]);
    setSalvandoMenu(false); setMenuUser(null);
  }

  const colSpan = ehAdmin ? 5 : 4;

  return (
    <>
      {ehAdmin && (
        <div className="flex justify-end mb-3">
          <button onClick={abrirCriar} className="btn-primario text-[13px] px-4 py-2">+ Novo usuário</button>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Nome</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">E-mail</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Papel</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Status</th>
              {ehAdmin && <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Menus</th>}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const iniciais = (u.nome ?? "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
              const p = PAPEL_LABEL[u.papel] ?? PAPEL_LABEL.leitura;
              const qtdExcecoes = overrides.filter((o) => o.perfil_id === u.id).length;
              return (
                <tr key={u.id} className="h-14 border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa]">
                  <td className="px-4 text-[13px] font-medium">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[#e9ecef] text-[#1a1a1a] grid place-items-center text-[10px] font-semibold shrink-0">{iniciais}</span>
                      {u.nome}
                      {u.id === meuId && <span className="text-[10px] text-[#adb5bd] font-normal">(você)</span>}
                    </div>
                  </td>
                  <td className="px-4 text-[13px] text-[#6c757d]">{u.email}</td>
                  <td className="px-4">
                    {ehAdmin ? (
                      <select value={u.papel} disabled={salvandoId === u.id}
                        onChange={(e) => mudarPapel(u.id, e.target.value)}
                        className="border border-linha rounded-md px-2.5 py-1.5 text-[12.5px] capitalize disabled:opacity-50">
                        {PAPEIS.map((papel) => <option key={papel} value={papel}>{papel}</option>)}
                      </select>
                    ) : (
                      <span className={`badge ${p.cls}`}>{p.label}</span>
                    )}
                  </td>
                  <td className="px-4">
                    {ehAdmin ? (
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={u.ativo} disabled={salvandoId === u.id}
                          onChange={(e) => mudarAtivo(u.id, e.target.checked)} className="w-4 h-4" />
                        <span className="text-[12.5px] text-[#6c757d]">{u.ativo ? "Ativo" : "Inativo"}</span>
                      </label>
                    ) : (
                      <span className={`badge ${u.ativo ? "bg-ok-bg text-ok" : "bg-[#f1f3f5] text-[#adb5bd]"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                    )}
                  </td>
                  {ehAdmin && (
                    <td className="px-4">
                      <div className="flex items-center gap-2">
                      <button onClick={() => abrirMenus(u)}
                        className="text-[12px] font-semibold text-info border border-info/30 bg-info-bg rounded-md px-3 py-1.5 hover:bg-info/10 transition">
                        {u.papel === "admin" ? "Ver menus" : "Definir menus"}
                        {qtdExcecoes > 0 && u.papel !== "admin" && <span className="ml-1.5 text-[10px] text-[#adb5bd]">({qtdExcecoes})</span>}
                      </button>
                      {u.papel !== "admin" && (
                        <button onClick={() => abrirTipos(u)}
                          title="Quais tipos de conta esta pessoa enxerga"
                          className="text-[12px] font-semibold text-amb border border-amarelo/40 bg-amb-bg rounded-md px-3 py-1.5 hover:bg-amarelo/10 transition">
                          Tipos de conta
                          {u.tipos_permitidos && (
                            <span className="ml-1.5 text-[10px] text-[#adb5bd]">({u.tipos_permitidos.length})</span>
                          )}
                        </button>
                      )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {usuarios.length === 0 && (
              <tr><td colSpan={colSpan} className="text-center py-12 text-[#adb5bd]">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table></div>
        {aviso && <div className="px-4 py-2.5 text-[12px] text-alerr bg-alerr-bg border-t border-linha2">{aviso}</div>}
      </div>

      {ehAdmin && (
        <div className="text-[11px] text-[#adb5bd] mt-3 leading-relaxed">
          admin vê e muda tudo · gestor aprova pagamentos e vê Cofre/Relatórios · operador lança contas · leitura só consulta.
          Uma pessoa só aparece aqui depois do primeiro login dela no sistema.
        </div>
      )}

      {menuUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setMenuUser(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-forte border border-linha w-full max-w-[460px] max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-linha">
              <div className="text-[15px] font-bold text-[#1a1a1a]">Menus de {menuUser.nome}</div>
              <div className="text-[12px] text-[#6c757d] mt-0.5">Escolha quais itens do menu essa pessoa pode ver.</div>
            </div>

            {menuUser.papel === "admin" ? (
              <div className="p-5 text-[13px] text-[#6c757d]">
                Este usuário é <b>admin</b> — vê todos os menus por padrão, e isso não pode ser restringido aqui
                (pra ninguém se trancar pra fora do sistema). Rebaixe o papel dele se quiser limitar o acesso.
              </div>
            ) : (
              <>
                <div className="p-5 overflow-y-auto space-y-1">
                  {menuItens.map((item) => {
                    const padrao = padraoDoPapel(item, menuUser.papel);
                    const marcado = checks[item.id];
                    const ehExcecao = marcado !== padrao;
                    return (
                      <label key={item.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-off cursor-pointer">
                        <input type="checkbox" checked={!!marcado} className="w-4 h-4"
                          onChange={(e) => setChecks((c) => ({ ...c, [item.id]: e.target.checked }))} />
                        <span className="text-[13px] font-medium flex-1">{item.label}</span>
                        {ehExcecao && <span className="text-[10px] text-amarelo-dark bg-amarelo/15 rounded px-1.5 py-0.5">exceção</span>}
                        {!ehExcecao && !padrao && <span className="text-[10px] text-[#adb5bd]">oculto p/ {menuUser.papel}</span>}
                      </label>
                    );
                  })}
                  {menuItens.length === 0 && <div className="text-[12px] text-[#adb5bd]">Nenhum item de menu cadastrado.</div>}
                </div>
                <div className="px-5 py-4 border-t border-linha flex gap-2">
                  <button onClick={salvarMenus} disabled={salvandoMenu} className="btn-primario flex-1 disabled:opacity-50">
                    {salvandoMenu ? "Salvando..." : "Salvar menus"}
                  </button>
                  <button onClick={() => setMenuUser(null)} className="btn-secundario">Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {criando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setCriando(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-forte border border-linha w-full max-w-[460px] max-h-[88vh] flex flex-col">
            <div className="px-5 py-4 border-b border-linha">
              <div className="text-[15px] font-bold text-[#1a1a1a]">Novo usuário</div>
              <div className="text-[12px] text-[#6c757d] mt-0.5">Cria o login, define o papel e os menus. A pessoa já entra com a senha que você definir.</div>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              <label className="block">
                <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Nome</div>
                <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="input-padrao w-full" placeholder="Nome da pessoa" />
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">E-mail</div>
                <input value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} type="email" className="input-padrao w-full" placeholder="pessoa@potencialgrupo.com.br" />
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Senha inicial</div>
                <input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} type="text" className="input-padrao w-full font-mono" placeholder="mínimo 6 caracteres" />
                <div className="text-[10.5px] text-[#adb5bd] mt-1">A pessoa pode trocar depois em Configurações.</div>
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Papel</div>
                <select value={novoPapel} onChange={(e) => trocarPapelNovo(e.target.value)} className="input-padrao w-full capitalize">
                  {PAPEIS.map((papel) => <option key={papel} value={papel}>{papel}</option>)}
                </select>
              </label>

              <div>
                <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1.5">Menus que essa pessoa vê</div>
                <div className="border border-linha rounded-lg p-2 space-y-0.5 max-h-[210px] overflow-y-auto">
                  {menuItens.map((item) => {
                    const padrao = padraoDoPapel(item, novoPapel);
                    const marcado = novoChecks[item.id];
                    const ehExcecao = marcado !== padrao;
                    return (
                      <label key={item.id} className="flex items-center gap-3 py-1 px-1.5 rounded-md hover:bg-off cursor-pointer">
                        <input type="checkbox" checked={!!marcado} className="w-4 h-4"
                          onChange={(e) => setNovoChecks((c) => ({ ...c, [item.id]: e.target.checked }))} />
                        <span className="text-[13px] font-medium flex-1">{item.label}</span>
                        {ehExcecao && <span className="text-[10px] text-amarelo-dark bg-amarelo/15 rounded px-1.5 py-0.5">exceção</span>}
                      </label>
                    );
                  })}
                  {menuItens.length === 0 && <div className="text-[12px] text-[#adb5bd] px-1.5 py-1">Nenhum item de menu cadastrado.</div>}
                </div>
                {novoPapel === "admin" && (
                  <div className="text-[10.5px] text-[#adb5bd] mt-1">Admin vê todos os menus de qualquer forma.</div>
                )}
              </div>

              {erroNovo && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{erroNovo}</div>}
            </div>
            <div className="px-5 py-4 border-t border-linha flex gap-2">
              <button onClick={criarUsuario} disabled={salvandoNovo || !novoEmail || novaSenha.length < 6}
                className="btn-primario flex-1 disabled:opacity-50">
                {salvandoNovo ? "Criando..." : "Criar usuário"}
              </button>
              <button onClick={() => setCriando(false)} className="btn-secundario">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {editandoTipos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setEditandoTipos(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-forte border border-linha w-full max-w-[460px] p-5">
            <div className="text-[15px] font-bold text-[#1a1a1a]">Tipos de conta</div>
            <p className="text-[12.5px] text-[#6c757d] mt-1">{editandoTipos.nome}</p>

            <label className="flex items-center gap-2.5 mt-4 p-3 rounded-lg border border-linha cursor-pointer hover:border-txt-3 transition">
              <input type="checkbox" checked={todosTipos} onChange={(e) => setTodosTipos(e.target.checked)} className="w-4 h-4" />
              <div>
                <div className="text-[13px] font-medium text-[#1a1a1a]">Todos os tipos</div>
                <div className="text-[11.5px] text-[#6c757d]">Enxerga qualquer conta, como hoje</div>
              </div>
            </label>

            {!todosTipos && (
              <div className="mt-3 border border-linha rounded-lg divide-y divide-linha2 max-h-[280px] overflow-y-auto">
                {TIPOS_LISTA.map((t) => (
                  <label key={t.valor} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-off transition">
                    <input type="checkbox" className="w-4 h-4"
                      checked={tiposMarcados.includes(t.valor)}
                      onChange={(e) => setTiposMarcados((lista) =>
                        e.target.checked ? [...lista, t.valor] : lista.filter((x) => x !== t.valor))} />
                    <span className="text-[13px] text-[#1a1a1a]">{t.rotulo}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="text-[11.5px] text-info bg-info-bg rounded-md px-3 py-2.5 mt-3 leading-relaxed">
              A restrição vale no banco, não só na tela: o que não estiver marcado
              não aparece em Contas, Aprovações, Relatórios nem em exportação — e
              também não volta se alguém chamar a API direto.
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={salvarTipos} disabled={salvandoId === editandoTipos.id}
                className="btn-primario flex-1 disabled:opacity-50">
                {salvandoId === editandoTipos.id ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setEditandoTipos(null)} className="btn-secundario">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}