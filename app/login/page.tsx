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
    <div className="min-h-screen md:flex">
      {/* Lado esquerdo - preto */}
      <div className="bg-[#1a1a1a] md:w-1/2 h-[40vh] md:h-screen flex items-center justify-center px-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-[200px] flex flex-col items-center">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
              <path d="M18 8h20c11 0 18 7 18 17s-7 17-18 17H30v22H18V8z" fill="#FFC107" />
              <path d="M30 20h7c4.5 0 7 2.2 7 5.5S41.5 31 37 31h-7V20z" fill="#1a1a1a" />
            </svg>
            <div className="text-white font-disp font-bold text-[26px] tracking-tight mt-3 leading-none">POTENCIAL</div>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="h-px w-6 bg-amarelo" />
              <span className="text-amarelo font-disp font-bold text-[13px] tracking-[4px]">CONTAS</span>
              <span className="h-px w-6 bg-amarelo" />
            </div>
          </div>
        </div>
      </div>

      {/* Lado direito - branco */}
      <div className="bg-white md:w-1/2 min-h-[60vh] md:h-screen flex items-center justify-center px-8 md:px-[60px] py-10">
        <form onSubmit={entrar} className="w-full max-w-[400px]">
          <h1 className="text-[#1a1a1a] font-disp font-bold text-[40px] md:text-[48px] leading-none mb-2">Entrar</h1>
          <p className="text-[#666] text-sm mb-10">Acesse com seu e-mail do Grupo Potencial.</p>

          <label className="block text-[#1a1a1a] text-xs font-semibold mb-2">E-mail</label>
          <div className="relative mb-5">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#999" strokeWidth="1.6">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2" /><path d="M3 5.5l7 5 7-5" />
            </svg>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full h-12 bg-[#f9f9f9] border border-[#e0e0e0] rounded-md pl-11 pr-4 text-[13px] text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10"
            />
          </div>

          <label className="block text-[#1a1a1a] text-xs font-semibold mb-2">Senha</label>
          <div className="relative mb-8">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#999" strokeWidth="1.6">
              <rect x="4" y="8.5" width="12" height="8" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 017 0v2.5" />
            </svg>
            <input
              type={verSenha ? "text" : "password"} required value={senha} onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
              className="w-full h-12 bg-[#f9f9f9] border border-[#e0e0e0] rounded-md pl-11 pr-11 text-[13px] text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10"
            />
            <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1a1a1a]">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.3" /></svg>
            </button>
          </div>

          {erro && <p className="text-alerr text-sm mb-4 -mt-4">{erro}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full h-12 bg-amarelo hover:bg-amarelo-dark text-[#1a1a1a] font-semibold rounded-md text-base transition-colors duration-300 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
