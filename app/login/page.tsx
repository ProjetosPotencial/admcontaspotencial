"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [modoRecuperar, setModoRecuperar] = useState(false);

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

  async function recuperarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (!email) { setErro("Digita seu e-mail primeiro."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) { setErro("Não foi possível enviar o link de recuperação."); return; }
    setAviso("Se esse e-mail estiver cadastrado, mandamos um link de recuperação pra ele.");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] relative overflow-hidden flex flex-col items-center justify-center px-6 py-12">
      <CircuitoFundo />

      <div className="relative z-10 flex flex-col items-center text-center mb-8">
        <Image src="/logo-grupo-potencial.png" alt="Grupo Potencial" width={340} height={80} priority className="my-1" />
        <div className="text-[12px] tracking-[3px] mt-1">
          <span className="text-white/70 font-semibold">AUTOMAÇÃO </span>
          <span className="text-amarelo font-semibold">INTELIGENTE</span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[420px] bg-[#141416] border border-white/10 rounded-2xl p-8 shadow-forte">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-ebano border border-white/10 grid place-items-center mb-4 shrink-0">
            <svg width="30" height="30" viewBox="0 0 72 72" fill="none">
              <path d="M18 8h20c11 0 18 7 18 17s-7 17-18 17H30v22H18V8z" fill="#FFC107" />
              <path d="M30 20h7c4.5 0 7 2.2 7 5.5S41.5 31 37 31h-7V20z" fill="#1a1c1e" />
            </svg>
          </div>
          {!modoRecuperar ? (
            <p className="text-white/40 text-[13px] mt-1">Acesse sua conta para continuar</p>
          ) : (
            <>
              <h1 className="text-white font-disp font-bold text-[19px]">Recuperar senha</h1>
              <p className="text-white/40 text-[13px] mt-1">Manda um link de recuperação pro seu e-mail</p>
            </>
          )}
        </div>

        <form onSubmit={modoRecuperar ? recuperarSenha : entrar}>
          <div className="relative mb-4">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#6b6b6b" strokeWidth="1.6">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2" /><path d="M3 5.5l7 5 7-5" />
            </svg>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full h-12 bg-[#1c1c1f] border border-white/10 rounded-lg pl-11 pr-4 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10"
            />
          </div>

          {!modoRecuperar && (
            <div className="relative mb-4">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#6b6b6b" strokeWidth="1.6">
                <rect x="4" y="8.5" width="12" height="8" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 017 0v2.5" />
              </svg>
              <input
                type={verSenha ? "text" : "password"} required value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                className="w-full h-12 bg-[#1c1c1f] border border-white/10 rounded-lg pl-11 pr-11 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10"
              />
              <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.3" /></svg>
              </button>
            </div>
          )}

          {!modoRecuperar && (
            <div className="flex items-center justify-between mb-5 text-[12.5px]">
              <label className="flex items-center gap-2 text-white/50 cursor-pointer">
                <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className="w-3.5 h-3.5 accent-amarelo" />
                Lembrar de mim
              </label>
              <button type="button" onClick={() => { setModoRecuperar(true); setErro(null); setAviso(null); }} className="text-amarelo hover:underline">
                Esqueceu sua senha?
              </button>
            </div>
          )}

          {erro && <p className="text-alerr text-[13px] mb-4">{erro}</p>}
          {aviso && <p className="text-ok text-[13px] mb-4">{aviso}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full h-12 bg-amarelo hover:bg-amarelo-dark text-[#1a1a1a] font-bold rounded-lg text-[15px] transition-colors duration-300 disabled:opacity-60"
          >
            {loading ? "Aguarda..." : modoRecuperar ? "Enviar link" : "Entrar"}
          </button>

          {modoRecuperar && (
            <button type="button" onClick={() => { setModoRecuperar(false); setErro(null); setAviso(null); }}
              className="w-full text-center text-white/40 text-[12.5px] mt-4 hover:text-white/70">
              ← Voltar pro login
            </button>
          )}
        </form>

        {!modoRecuperar && (
          <div className="flex items-center gap-2 justify-center mt-6 text-white/25 text-[11px]">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 2l7 3v5c0 4.5-3 7.5-7 8.5C6 17.5 3 14.5 3 10V5l7-3z" /><path d="M7.5 10l2 2 3.5-4" /></svg>
            Acesso seguro e protegido
          </div>
        )}
      </div>
    </div>
  );
}

function CircuitoFundo() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.35] pointer-events-none" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <g stroke="#2a2a2e" strokeWidth="1.5" fill="none">
        <path d="M0 120h180l40 40h160" /><path d="M0 260h120l30-30h220" />
        <path d="M1600 120h-180l-40 40h-160" /><path d="M1600 260h-120l-30-30h-220" />
        <path d="M0 680h200l35 35h180" /><path d="M0 800h160l25-25h240" />
        <path d="M1600 680h-200l-35 35h-180" /><path d="M1600 800h-160l-25-25h-240" />
      </g>
      <g fill="#FFC107">
        <circle cx="180" cy="120" r="3" /><circle cx="1420" cy="120" r="3" />
        <circle cx="220" cy="800" r="3" /><circle cx="1380" cy="800" r="3" />
      </g>
    </svg>
  );
}
