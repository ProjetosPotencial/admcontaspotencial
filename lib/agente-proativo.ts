/**
 * Agente proativo: acompanha o que a pessoa está fazendo e fala com ela.
 *
 * É um event bus simples em memória (nível de módulo), pra qualquer tela
 * conseguir avisar o agente sem precisar de context/prop drilling:
 *
 *    import { agente } from "@/lib/agente-proativo";
 *    agente.evento("lancamento", { loja: "MG 073" });
 *
 * Quem exibe as mensagens é o <IaFlutuante />, que se inscreve aqui.
 */

export type TipoMensagem = "incentivo" | "lembrete" | "sugestao" | "alerta";

export type MensagemAgente = {
  id: string;
  tipo: TipoMensagem;
  texto: string;
  /** pergunta que vai pro chat se a pessoa clicar na mensagem */
  perguntaSugerida?: string;
};

type Ouvinte = (m: MensagemAgente) => void;

const INCENTIVOS = {
  lancamento: [
    "🎉 Opa! Mais uma conta lançada com sucesso. Bora para a próxima? Qualquer coisa, estarei por aqui!",
    "👏 Boa! Conta registrada. Seguimos.",
    "✨ Mais uma resolvida. Tá rendendo!",
  ],
  ritmo: "🚀 Ótimo ritmo! Você já lançou diversas contas hoje. Estamos avançando muito bem.",
  lojaConcluida: "✅ Excelente! Você finalizou todas as contas desta loja. Vamos seguir para a próxima.",
  tudoConcluido: "🎊 Parabéns! Todas as contas pendentes foram processadas. Excelente trabalho!",
};

const LEMBRETES = [
  "💧 Já faz um tempo que você está trabalhando. Que tal beber um copo de água?",
  "☕ Aproveite para fazer uma pausa rápida de 5 minutos e descansar a visão.",
  "🧘 Uma esticada nos ombros agora evita a dor no fim do dia.",
];

/** de quanto em quanto tempo lembrar de pausa/hidratação */
const INTERVALO_LEMBRETE_MS = 45 * 60 * 1000; // 45 min
/** a cada quantos lançamentos seguidos elogiar o ritmo */
const LANCAMENTOS_PARA_ELOGIAR_RITMO = 5;

function sorteia(lista: string[]) {
  return lista[Math.floor(Math.random() * lista.length)];
}

class AgenteProativo {
  private ouvintes = new Set<Ouvinte>();
  private lancamentosNaSessao = 0;
  private timerLembrete: ReturnType<typeof setInterval> | null = null;
  private lembreteAtual = 0;

  inscrever(fn: Ouvinte) {
    this.ouvintes.add(fn);
    this.iniciarLembretes();
    return () => {
      this.ouvintes.delete(fn);
      if (this.ouvintes.size === 0 && this.timerLembrete) {
        clearInterval(this.timerLembrete);
        this.timerLembrete = null;
      }
    };
  }

  private falar(tipo: TipoMensagem, texto: string, perguntaSugerida?: string) {
    const m: MensagemAgente = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tipo, texto, perguntaSugerida,
    };
    this.ouvintes.forEach((fn) => fn(m));
  }

  private iniciarLembretes() {
    if (this.timerLembrete || typeof window === "undefined") return;
    this.timerLembrete = setInterval(() => {
      // só lembra quem está de fato trabalhando (aba visível)
      if (document.visibilityState !== "visible") return;
      this.falar("lembrete", LEMBRETES[this.lembreteAtual % LEMBRETES.length]);
      this.lembreteAtual++;
    }, INTERVALO_LEMBRETE_MS);
  }

  /** contagem de lançamentos desta sessão (usada no painel) */
  get totalNaSessao() {
    return this.lancamentosNaSessao;
  }

  /**
   * Avisa o agente de algo que aconteceu na tela.
   * Chame de qualquer componente cliente.
   */
  evento(
    nome: "lancamento" | "loja_concluida" | "tudo_concluido" | "conta_encerrada" | "conta_reativada" | "erro",
    dados?: { loja?: string; tipo?: string; detalhe?: string }
  ) {
    switch (nome) {
      case "lancamento": {
        this.lancamentosNaSessao++;
        this.notificarSlack("lancamento", { loja: dados?.loja, tipo: dados?.tipo });
        if (this.lancamentosNaSessao > 0 && this.lancamentosNaSessao % LANCAMENTOS_PARA_ELOGIAR_RITMO === 0) {
          this.falar("incentivo", INCENTIVOS.ritmo, "Quantas contas eu já lancei hoje e quantas ainda faltam?");
        } else {
          this.falar("incentivo", sorteia(INCENTIVOS.lancamento), "Quantas contas ainda faltam lançar?");
        }
        break;
      }
      case "loja_concluida":
        this.falar("incentivo",
          dados?.loja ? `✅ Excelente! Você finalizou todas as contas da ${dados.loja}. Vamos seguir para a próxima.` : INCENTIVOS.lojaConcluida,
          "Quais lojas ainda têm pendências?");
        break;
      case "tudo_concluido":
        this.falar("incentivo", INCENTIVOS.tudoConcluido, "Me mostra um resumo do dia.");
        break;
      case "conta_encerrada":
        this.notificarSlack("encerrada", { loja: dados?.loja, tipo: dados?.tipo });
        this.falar("sugestao",
          `🏢 Conta encerrada${dados?.loja ? ` na ${dados.loja}` : ""}. Ela sai da lista e para de gerar cobrança — o cadastro fica salvo pra reativar depois.`);
        break;
      case "conta_reativada":
        this.notificarSlack("reativada", { loja: dados?.loja, tipo: dados?.tipo });
        this.falar("sugestao", "🔄 Conta reativada! Ela volta a aparecer e a gerar cobranças normalmente.");
        break;
      case "erro":
        this.falar("alerta", `⚠️ ${dados?.detalhe ?? "Algo não saiu como esperado."} Quer que eu ajude a entender?`,
          dados?.detalhe);
        break;
    }
  }

  /** avisa o Slack em segundo plano (falha aqui nunca atrapalha quem está usando) */
  notificarSlack(evento: string, dados: Record<string, unknown> = {}) {
    if (typeof window === "undefined") return;
    fetch("/api/notificar-evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evento, ...dados }),
    }).catch(() => {});
  }

  /** mensagem avulsa, se alguma tela quiser falar algo específico */
  sugerir(texto: string, perguntaSugerida?: string) {
    this.falar("sugestao", texto, perguntaSugerida);
  }
}

export const agente = new AgenteProativo();
