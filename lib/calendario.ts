/**
 * Calendário inteligente de dias úteis.
 *
 * Núcleo do sistema: sabe o que é dia útil considerando fins de semana e
 * feriados (nacionais, estaduais e municipais) e ajusta vencimentos que
 * caem em dia não útil conforme a regra da empresa.
 *
 * Os feriados móveis (Carnaval, Sexta-Feira Santa, Corpus Christi) são
 * calculados a partir da Páscoa, então valem para qualquer ano — não é
 * preciso cadastrar ano a ano.
 */

export type RegraVencimento = "antecipar" | "adiar" | "confirmar";

export type Feriado = {
  data: string;        // "YYYY-MM-DD"
  nome: string;
  escopo: "nacional" | "estadual" | "municipal" | "empresa";
  uf?: string | null;
  municipio?: string | null;
  facultativo?: boolean;
};

/* ---------- utilidades de data (sem fuso, só o dia) ---------- */

export function paraISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function deISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function somarDias(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/* ---------- feriados ---------- */

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/** Feriados nacionais do ano (fixos + móveis) */
export function feriadosNacionais(ano: number): Feriado[] {
  const p = pascoa(ano);
  const movel = (offset: number, nome: string, facultativo = false): Feriado => ({
    data: paraISO(somarDias(p, offset)), nome, escopo: "nacional", facultativo,
  });

  const fixos: [string, string][] = [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Consciência Negra"],
    ["12-25", "Natal"],
  ];

  return [
    ...fixos.map(([md, nome]) => ({ data: `${ano}-${md}`, nome, escopo: "nacional" as const })),
    movel(-48, "Carnaval (segunda)", true),
    movel(-47, "Carnaval", true),
    movel(-46, "Quarta-feira de Cinzas (até 14h)", true),
    movel(-2, "Sexta-feira Santa"),
    movel(60, "Corpus Christi", true),
  ];
}

/* ---------- o calendário de uma loja ---------- */

export class Calendario {
  private mapa = new Map<string, Feriado>();

  /**
   * @param extras feriados estaduais/municipais/da empresa vindos do banco
   * @param considerarFacultativos se true, ponto facultativo também não é dia útil
   */
  constructor(
    anos: number[],
    extras: Feriado[] = [],
    private considerarFacultativos = false
  ) {
    for (const ano of anos) {
      for (const f of feriadosNacionais(ano)) this.add(f);
    }
    for (const f of extras) this.add(f);
  }

  private add(f: Feriado) {
    if (f.facultativo && !this.considerarFacultativos) return;
    this.mapa.set(f.data, f);
  }

  feriadoEm(data: Date | string): Feriado | null {
    const iso = typeof data === "string" ? data : paraISO(data);
    return this.mapa.get(iso) ?? null;
  }

  ehFimDeSemana(data: Date | string): boolean {
    const d = typeof data === "string" ? deISO(data) : data;
    const dia = d.getDay();
    return dia === 0 || dia === 6;
  }

  ehDiaUtil(data: Date | string): boolean {
    return !this.ehFimDeSemana(data) && !this.feriadoEm(data);
  }

  /** motivo pelo qual não é dia útil (pra mostrar na tela / avisos da IA) */
  motivoNaoUtil(data: Date | string): string | null {
    const d = typeof data === "string" ? deISO(data) : data;
    const f = this.feriadoEm(d);
    if (f) return f.nome;
    const dia = d.getDay();
    if (dia === 0) return "domingo";
    if (dia === 6) return "sábado";
    return null;
  }

  proximoDiaUtil(data: Date | string): Date {
    let d = typeof data === "string" ? deISO(data) : data;
    let guarda = 0;
    while (!this.ehDiaUtil(d) && guarda++ < 30) d = somarDias(d, 1);
    return d;
  }

  diaUtilAnterior(data: Date | string): Date {
    let d = typeof data === "string" ? deISO(data) : data;
    let guarda = 0;
    while (!this.ehDiaUtil(d) && guarda++ < 30) d = somarDias(d, -1);
    return d;
  }

  /**
   * Ajusta um vencimento conforme a regra da empresa.
   * Devolve a data efetiva + se houve ajuste + o motivo.
   */
  ajustarVencimento(data: Date | string, regra: RegraVencimento) {
    const original = typeof data === "string" ? deISO(data) : data;
    if (this.ehDiaUtil(original)) {
      return { data: original, ajustada: false, motivo: null as string | null, regra, precisaConfirmar: false };
    }
    const motivo = this.motivoNaoUtil(original);
    if (regra === "antecipar") {
      return { data: this.diaUtilAnterior(original), ajustada: true, motivo, regra, precisaConfirmar: false };
    }
    if (regra === "adiar") {
      return { data: this.proximoDiaUtil(original), ajustada: true, motivo, regra, precisaConfirmar: false };
    }
    // "confirmar": não decide sozinho, devolve as opções pra pessoa escolher
    return {
      data: original, ajustada: false, motivo, regra, precisaConfirmar: true,
      sugestoes: { antecipar: this.diaUtilAnterior(original), adiar: this.proximoDiaUtil(original) },
    };
  }

  /**
   * Vencimento efetivo de uma conta num mês, a partir do dia cadastrado.
   * Se o dia não existe no mês (ex.: 31 em fevereiro), usa o último dia.
   */
  vencimentoDoMes(diaCadastrado: number, ano: number, mes: number, regra: RegraVencimento) {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dia = Math.min(diaCadastrado, ultimoDia);
    return this.ajustarVencimento(new Date(ano, mes - 1, dia), regra);
  }

  /**
   * Uma conta só está atrasada se o vencimento EFETIVO (já ajustado)
   * ficou para trás. Conta ajustada pelo calendário nunca conta como atraso.
   */
  estaAtrasada(
    diaCadastrado: number | null,
    ano: number,
    mes: number,
    regra: RegraVencimento,
    hoje: Date = new Date()
  ): boolean {
    if (diaCadastrado == null) return false;
    const { data } = this.vencimentoDoMes(diaCadastrado, ano, mes, regra);
    const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return data.getTime() < h.getTime();
  }

  /** dias úteis entre duas datas (útil para prazos e relatórios) */
  diasUteisEntre(inicio: Date | string, fim: Date | string): number {
    let d = typeof inicio === "string" ? deISO(inicio) : inicio;
    const f = typeof fim === "string" ? deISO(fim) : fim;
    let n = 0;
    while (d.getTime() <= f.getTime()) {
      if (this.ehDiaUtil(d)) n++;
      d = somarDias(d, 1);
    }
    return n;
  }
}

/** monta o calendário de uma loja a partir da UF/município dela */
export function calendarioDaLoja(
  anos: number[],
  todosFeriados: Feriado[],
  uf?: string | null,
  municipio?: string | null,
  considerarFacultativos = false
) {
  const relevantes = todosFeriados.filter((f) => {
    if (f.escopo === "nacional" || f.escopo === "empresa") return true;
    if (f.escopo === "estadual") return !!uf && f.uf === uf;
    if (f.escopo === "municipal") return !!municipio && f.municipio === municipio && (!f.uf || f.uf === uf);
    return false;
  });
  return new Calendario(anos, relevantes, considerarFacultativos);
}
