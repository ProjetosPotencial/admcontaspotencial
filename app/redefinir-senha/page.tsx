"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    // o link do e-mail chega com um token na URL que o supabase-js já lê
    // sozinho e transforma numa sessão temporária de "recovery". Só
    // confere se essa sessão existe antes de liberar o formulário.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPronto(!!session);
      if (!session) setErro("Esse link expirou ou já foi usado. Pede um novo em 'Esqueceu sua senha?' na tela de login.");
    });
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (senha !== confirmar) { setErro("As senhas não são iguais."); return; }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar a senha nova. Tenta pedir um link novo."); return; }
    setSucesso(true);
    setTimeout(() => { router.push("/painel"); router.refresh(); }, 1800);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px] bg-[#141416] border border-white/10 rounded-2xl p-8 shadow-forte">
        <h1 className="text-white font-disp font-bold text-[19px] text-center mb-1">Definir nova senha</h1>
        <p className="text-white/40 text-[13px] text-center mb-6">Escolhe uma senha nova pra sua conta</p>

        {sucesso ? (
          <div className="text-center py-6">
            <div className="text-ok text-[14px] font-semibold mb-1">Senha alterada!</div>
            <p className="text-white/40 text-[13px]">Te levando pro sistema...</p>
          </div>
        ) : !pronto ? (
          <div className="text-alerr text-[13px] text-center leading-relaxed">{erro}</div>
        ) : (
          <form onSubmit={salvar}>
            <div className="relative mb-4">
              <input
                type={verSenha ? "text" : "password"} required value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha nova"
                className="w-full h-12 bg-[#1c1c1f] border border-white/10 rounded-lg pl-4 pr-11 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10"
              />
              <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.3" /></svg>
              </button>
            </div>
            <input
              type={verSenha ? "text" : "password"} required value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Confirmar senha nova"
              className="w-full h-12 bg-[#1c1c1f] border border-white/10 rounded-lg px-4 text-[13px] text-white placeholder:text-white/30 mb-5 focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10"
            />
            {erro && <p className="text-alerr text-[13px] mb-4">{erro}</p>}
            <button type="submit" disabled={salvando}
              className="w-full h-12 bg-amarelo hover:bg-amarelo-dark text-[#1a1a1a] font-bold rounded-lg text-[15px] transition-colors disabled:opacity-60">
              {salvando ? "Salvando..." : "Salvar senha nova"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
