const REGRAS = [
  {
    tipo: "Valor mensal", cor: "#1976d2",
    desc: "Antes de pagar, alguém precisa conferir o valor lançado por mês em cada conta.",
    quem: "Gestor ou administrador",
  },
  {
    tipo: "Cadastro de conta nova", cor: "#8e24aa",
    desc: "Toda conta nova cadastrada entra revisável até ser confirmada.",
    quem: "Gestor ou administrador",
  },
  {
    tipo: "Rateio", cor: "#fb8c00",
    desc: "Contas marcadas como rateio (divididas entre lojas) exigem confirmação do divisor antes de lançar.",
    quem: "Gestor ou administrador",
  },
];

export default function RegrasAprovacaoPage() {
  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Regras de aprovação</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Como o sistema decide o que precisa de aprovação, e quem pode aprovar</p>
      </div>
      <div className="px-8 pb-8 max-w-[760px] space-y-4">
        {REGRAS.map((r) => (
          <div key={r.tipo} className="card p-5 flex gap-4 items-start">
            <span className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ background: r.cor }} />
            <div>
              <div className="text-[15px] font-semibold text-[#1a1a1a]">{r.tipo}</div>
              <p className="text-[13px] text-[#6c757d] mt-1 leading-relaxed">{r.desc}</p>
              <div className="text-[12px] text-[#adb5bd] mt-2">Quem aprova: <b className="text-[#1a1a1a] font-medium">{r.quem}</b></div>
            </div>
          </div>
        ))}
        <div className="text-[12px] text-[#adb5bd] bg-[#f1f3f5] rounded-md px-4 py-3 leading-relaxed">
          Essas regras são aplicadas diretamente no banco de dados (Supabase), não apenas na tela — mesmo uma tentativa de aprovar por fora do sistema respeita essas permissões.
        </div>
      </div>
    </>
  );
}
