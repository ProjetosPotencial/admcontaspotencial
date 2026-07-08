import { SITUACAO } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  if (status === "encerrado") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  const ativo = status === "ativo";
  return (
    <span className={`badge ${ativo ? "bg-ok-bg text-ok" : "bg-[#EEE] text-[#777]"}`}>
      {ativo ? "Ativa" : "Inativa"}
    </span>
  );
}

export function SituacaoBadge({ situacao }: { situacao: string }) {
  const s = SITUACAO[situacao] ?? { label: situacao, cls: "bg-[#EEE] text-[#777]" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
