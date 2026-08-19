/**
 * Faixa de erro no topo da tela.
 *
 * Existe porque as páginas faziam `const itens = (data ?? [])` e nunca liam
 * o `error` que vem junto. Quando a consulta falhava, a tela desenhava zeros
 * com toda a confiança — e uma falha de API recuperável ficava com cara de
 * perda de dados. Zero de verdade e "não consegui ler" precisam parecer
 * coisas diferentes.
 */
export default function ErroConsulta({ erros }: { erros: (unknown | null | undefined)[] }) {
  const reais = erros
    .filter(Boolean)
    .map((e: any) => ({
      mensagem: e?.message ?? String(e),
      detalhe: e?.details ?? e?.hint ?? null,
      codigo: e?.code ?? null,
    }));

  if (reais.length === 0) return null;

  return (
    <div className="mb-5 rounded-lg border border-alerr/40 bg-alerr-bg px-4 py-3">
      <div className="flex items-start gap-2.5">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="#D32F2F" strokeWidth="1.8"
          strokeLinecap="round" className="shrink-0 mt-0.5">
          <path d="M10.9 3.6l7.6 13a1 1 0 01-.9 1.5H2.4a1 1 0 01-.9-1.5l7.6-13a1 1 0 011.8 0z" />
          <path d="M10 8.5v4M10 15.2v.1" />
        </svg>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-alerr">
            Não foi possível carregar os dados desta tela.
          </div>
          <p className="text-[11.5px] text-[#7a3838] mt-1 leading-relaxed">
            Os números abaixo estão zerados porque a consulta falhou — não porque não existam lançamentos.
            Nada foi perdido no banco.
          </p>
          <ul className="mt-2 space-y-1">
            {reais.map((e, i) => (
              <li key={i} className="text-[11.5px] font-mono text-[#7a3838] break-all">
                {e.codigo ? `[${e.codigo}] ` : ""}{e.mensagem}
                {e.detalhe ? ` — ${e.detalhe}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
