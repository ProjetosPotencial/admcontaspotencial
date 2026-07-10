"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TrocarSenhaForm() {
  const supabase = createClient();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    if (novaSenha.length < 6) { setErro("A senha nova precisa ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirmar) { setErro("As senhas não são iguais."); return; }

    setSalvando(true);

    // confirma a senha atual antes de trocar, tentando logar de novo com
    // ela - evita que alguém troque a senha de uma sessão que ficou aberta
    // sem querer no computador de outra pessoa.
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { error: erroConfirmacao } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaAtual });
      if (erroConfirmacao) {
        setSalvando(false);
        setErro("Senha atual incorreta.");
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvando(false);
    if (error) { setErro("Não foi possível trocar a senha."); return; }
    setSucesso(true);
    setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
  }

  return (
    <form onSubmit={salvar} className="card p-5 max-w-[420px] space-y-3.5">
      <label>
        <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Senha atual</div>
        <input type="password" required value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} className="input-padrao w-full" />
      </label>
      <label>
        <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Senha nova</div>
        <input type="password" required value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="input-padrao w-full" />
      </label>
      <label>
        <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Confirmar senha nova</div>
        <input type="password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="input-padrao w-full" />
      </label>
      {erro && <div className="text-[12.5px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{erro}</div>}
      {sucesso && <div className="text-[12.5px] text-ok bg-ok-bg rounded-md px-3 py-2">Senha trocada com sucesso.</div>}
      <button type="submit" disabled={salvando} className="btn-primario w-full disabled:opacity-50">
        {salvando ? "Salvando..." : "Trocar senha"}
      </button>
    </form>
  );
}
