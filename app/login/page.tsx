"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) {
      setErro("E-mail ou senha incorretos.");
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* lado da marca */}
      <div className="hidden lg:flex flex-col justify-center items-start bg-ebano p-16 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amarelo relative shrink-0 rotate-[-4deg]">
            <span className="absolute inset-[15px] rounded-[4px] bg-ebano block" />
          </div>
          <div>
            <div className="font-disp font-extrabold text-4xl text-white tracking-tight leading-none">POTENCIAL</div>
            <div className="font-disp font-bold text-amarelo tracking-[6px] text-sm mt-1">CONTAS</div>
          </div>
        </div>
        <p className="text-white/40 mt-10 max-w-sm text-sm leading-relaxed">
          Controle de contas de consumo das lojas e quiosques do Grupo Potencial. Água, energia, telefone, IPTU e mais, com aprovação e cofre de credenciais.
        </p>
      </div>

      {/* formulário */}
      <div className="flex items-center justify-center p-8 bg-white">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-amarelo relative">
              <span className="absolute inset-[10px] rounded-[3px] bg-ebano block" />
            </div>
            <b className="font-disp font-extrabold text-lg">POTENCIAL CONTAS</b>
          </div>
          <h2 className="font-disp text-5xl font-extrabold tracking-tight mb-8">Entrar</h2>

          <label className="block text-sm font-semibold text-txt mb-2">E-mail</label>
          <div className="relative mb-5">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#8a8880" strokeWidth="1.6">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2" /><path d="M3 5.5l7 5 7-5" />
            </svg>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-off border border-linha rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amarelo"
            />
          </div>

          <label className="block text-sm font-semibold text-txt mb-2">Senha</label>
          <div className="relative mb-2">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#8a8880" strokeWidth="1.6">
              <rect x="4" y="8.5" width="12" height="8" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 017 0v2.5" />
            </svg>
            <input
              type={verSenha ? "text" : "password"} required value={senha} onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
              className="w-full bg-off border border-linha rounded-xl pl-12 pr-11 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amarelo"
            />
            <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-3">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.3" /></svg>
            </button>
          </div>
          {erro && <p className="text-alerr text-sm mb-2 mt-2">{erro}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full mt-6 bg-amarelo text-ebano font-bold rounded-xl py-3.5 text-base hover:brightness-95 disabled:opacity-60 transition"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
