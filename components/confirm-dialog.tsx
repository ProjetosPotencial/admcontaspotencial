"use client";

// Diálogo de confirmação para ações críticas (aprovar, recusar, excluir, pagar,
// desativar). Mostra título, mensagem, e botões de confirmar/cancelar. O tom
// "perigo" deixa o botão vermelho para ações irreversíveis.

export default function ConfirmDialog({
  aberto,
  titulo,
  mensagem,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  tom = "normal",
  onConfirmar,
  onCancelar,
  processando = false,
}: {
  aberto: boolean;
  titulo: string;
  mensagem?: React.ReactNode;
  confirmarLabel?: string;
  cancelarLabel?: string;
  tom?: "normal" | "perigo";
  onConfirmar: () => void;
  onCancelar: () => void;
  processando?: boolean;
}) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={processando ? undefined : onCancelar} />
      <div className="relative bg-white rounded-xl shadow-forte w-full max-w-md p-6">
        <h3 className="text-[16px] font-semibold text-txt">{titulo}</h3>
        {mensagem && <div className="text-[13.5px] text-txt-2 mt-2 leading-relaxed">{mensagem}</div>}
        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={onCancelar} disabled={processando} className="btn-secundario disabled:opacity-50">
            {cancelarLabel}
          </button>
          <button
            onClick={onConfirmar}
            disabled={processando}
            className={`${tom === "perigo" ? "btn-perigo" : "btn-primario"} disabled:opacity-50`}
          >
            {processando ? "Processando..." : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
