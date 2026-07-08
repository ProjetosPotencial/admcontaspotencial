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
      <div className="hidden lg:flex flex-col justify-between bg-ebano p-14 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amarelo relative">
            <span className="absolute inset-[9px] rounded-[2px] bg-ebano block" />
          </div>
          <div>
            <b className="font-disp font-bold text-[15px] leading-none block">Potencial</b>
            <span className="text-amarelo text-[10px] tracking-[2px] uppercase font-semibold">Contas</span>
          </div>
        </div>
        <div>
          <div className="kicker text-amarelo mb-3">Contas de consumo</div>
          <h1 className="font-disp text-4xl font-semibold leading-tight max-w-md">
            O controle das contas das lojas, com rastro e sem senha em texto aberto.
          </h1>
          <p className="text-white/50 mt-4 max-w-md text-sm">
            Água, energia, telefone, IPTU e mais, de todas as COBANs e quiosques, num só lugar.
          </p>
        </div>
        <div className="text-white/30 text-xs font-mono">Grupo Potencial · uso interno</div>
      </div>

      {/* formulário */}
      <div className="flex items-center justify-center p-8 bg-papel">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-amarelo relative">
              <span className="absolute inset-[9px] rounded-[2px] bg-ebano block" />
            </div>
            <b className="font-disp font-bold text-[15px]">Potencial Contas</b>
          </div>
          <h2 className="font-disp text-2xl font-semibold">Entrar</h2>
          <p className="text-txt-2 text-sm mt-1 mb-7">Acesse com seu e-mail do Grupo Potencial.</p>

          <label className="block text-[11px] font-semibold text-txt-2 mb-1.5 uppercase tracking-wide">E-mail</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@potencialgrupo.com.br"
            className="w-full bg-white border border-linha rounded-[10px] px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amarelo"
          />
          <label className="block text-[11px] font-semibold text-txt-2 mb-1.5 uppercase tracking-wide">Senha</label>
          <input
            type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white border border-linha rounded-[10px] px-4 py-3 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-amarelo"
          />
          {erro && <p className="text-alerr text-sm mb-2">{erro}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full mt-4 bg-amarelo text-ebano font-semibold rounded-[10px] py-3 text-sm hover:brightness-95 disabled:opacity-60 transition"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
