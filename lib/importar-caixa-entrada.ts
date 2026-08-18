import { createAdminClient } from "@/lib/supabase/admin";
import { listarArquivosNaPasta, baixarArquivoDoDrive, listarChamadosGLPI, listarReenviosGLPI } from "@/lib/google-drive";
import { buscarDadosChamado } from "@/lib/glpi";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";
import { criarCardDeDocumento } from "@/lib/processar-documento";
import { processarFilaSlack } from "@/lib/slack-fila";

export async function importarCaixaEntradaDrive() {
  const pastaId = process.env.GOOGLE_DRIVE_INBOX_FOLDER_ID;
  if (!pastaId) {
    return { ok: false as const, error: "GOOGLE_DRIVE_INBOX_FOLDER_ID não configurado." };
  }

  const supabase = createAdminClient();

  const [arquivos, { data: jaImportados }, { data: lojas }] = await Promise.all([
    listarArquivosNaPasta(pastaId),
    supabase.from("caixa_entrada_boletos").select("drive_file_id"),
    supabase.from("lojas").select("id, codigo, nome, cidade").eq("status", "ativo"),
  ]);

  const idsJaImportados = new Set((jaImportados ?? []).map((r) => r.drive_file_id));
  const novos = arquivos.filter((a) => !idsJaImportados.has(a.id));

  let processados = 0;
  const erros: string[] = [];

  // Não sai cedo se não houver arquivo solto novo: o fluxo GLPI (pasta
  // Compras) roda de qualquer jeito, independente dos arquivos da raiz.
  for (const arquivo of novos) {
    try {
      const buffer = await baixarArquivoDoDrive(arquivo.id);
      await criarCardDeDocumento({
        supabase,
        fonteId: arquivo.id,
        nomeArquivo: arquivo.name,
        link: arquivo.webViewLink,
        buffer,
        mimeType: arquivo.mimeType,
        lojas: (lojas ?? []) as any,
        extras: { origem_entrada: "drive" },
      });
      processados++;
    } catch (err: any) {
      erros.push(`${arquivo.name}: ${err?.message ?? "erro desconhecido"}`);
    }
  }

  // ========================================================================
  // GLPI: pasta "Compras" com estrutura Chamado NNNNN / <rótulo> / PDFs.
  // Cada chamado vira UM card na Caixa, combinando NF + boleto. O rótulo da
  // pasta é só exibição — quem confirma escolhe o destino. Dedup por pasta.
  // ========================================================================
  let chamadosNovos = 0, docsChamado = 0, pendentesConf = 0, reaberturasAtualizadas = 0;
  try {
    const chamados = await listarChamadosGLPI(pastaId);
    const { data: jaProcessados } = await supabase
      .from("caixa_entrada_boletos")
      .select("id, chamado_pasta_id, chamado_file_ids, status, lancamento_criado_id, requerente")
      .not("chamado_pasta_id", "is", null);
    const porPasta = new Map((jaProcessados ?? []).map((r: any) => [r.chamado_pasta_id, r]));

    for (const ch of chamados) {
      try {
        const pdfs = ch.arquivos.filter((a) => a.mimeType === "application/pdf" || /\.pdf$/i.test(a.name));
        const assinatura = pdfs.map((p) => p.id).sort().join(",");
        const existente: any = porPasta.get(ch.pastaId);
        if (existente) {
          // legado (sem assinatura): registra a assinatura atual e NÃO reprocessa
          if (existente.chamado_file_ids == null) {
            await supabase.from("caixa_entrada_boletos").update({ chamado_file_ids: assinatura }).eq("id", existente.id);
            continue;
          }
          // nada mudou na pasta → pula (comportamento normal)
          if (existente.chamado_file_ids === assinatura) continue;
          // senão: REABERTURA — a pasta ganhou/trocou arquivo. Relê e atualiza.
        }
        let nf: any = null, boleto: any = null;
        let falhaLeitura = false;
        for (const pdf of pdfs) {
          try {
            const buf = await baixarArquivoDoDrive(pdf.id);
            const ex = await extrairDadosBoleto(buf, pdf.name, pdf.mimeType);
            docsChamado++;
            if (!nf && ex.classe_documento === "nota_fiscal") nf = ex;
            else if (!boleto && (ex.codigo_barras || ex.classe_documento === "boleto")) boleto = ex;
            else if (!nf && (ex.fornecedor || ex.numero_documento)) nf = ex; // sobra que parece nota
          } catch (errArq: any) {
            // um PDF ruim não derruba o chamado; marca leitura falha e segue
            falhaLeitura = true;
            erros.push(`Chamado ${ch.chamadoNumero ?? ch.pastaId} / ${pdf.name}: ${errArq?.message ?? "erro na leitura"}`);
          }
        }

        // Cria o card com o que houver. Só é problema se não veio NENHUM PDF
        // legível. Pendente de conferência quando falta a NF, falta o boleto,
        // ou algum documento veio ilegível — mas o chamado sempre aparece.
        const semDocumento = pdfs.length === 0 || (!nf && !boleto);
        const ilegivel = falhaLeitura || (nf && !nf.parece_documento_valido) || (boleto && !boleto.parece_documento_valido);
        const pendente = semDocumento || !nf || !boleto || ilegivel;
        if (pendente) pendentesConf++;

        const obs = pendente
          ? `Pendente de conferência: ${[
              semDocumento && "nenhum documento legível na pasta",
              !semDocumento && !nf && "sem nota fiscal",
              !semDocumento && !boleto && "sem boleto",
              ilegivel && "documento ilegível",
            ].filter(Boolean).join("; ")}.`
          : null;

        // enriquece com dados do GLPI (requerente) — best-effort, não derruba
        const dadosGlpi = ch.chamadoNumero ? await buscarDadosChamado(ch.chamadoNumero) : null;

        const dadosDetectados = {
          fornecedor_detectado: nf?.fornecedor ?? null,
          cnpj_detectado: nf?.cnpj ?? null,
          destinatario_detectado: nf?.destinatario ?? null,
          destinatario_cnpj_detectado: nf?.destinatario_cnpj ?? null,
          chave_acesso: nf?.chave_acesso ?? null,
          numero_documento_detectado: nf?.numero_documento ?? null,
          emissao_ano: nf?.data_emissao?.ano ?? null,
          emissao_mes: nf?.data_emissao?.mes ?? null,
          emissao_dia: nf?.data_emissao?.dia ?? null,
          codigo_barras_detectado: boleto?.codigo_barras ?? null,
          valor_detectado: boleto?.valor ?? nf?.valor ?? null,
          confianca: pendente ? "baixa" : "media",
          observacao: obs,
          chamado_file_ids: assinatura,
        };

        if (!existente) {
          await supabase.from("caixa_entrada_boletos").insert({
            drive_file_id: ch.pastaId,
            nome_arquivo: `Chamado ${ch.chamadoNumero ?? "?"}${ch.lojaTexto ? " — " + ch.lojaTexto : ""}`,
            drive_web_view_link: `https://drive.google.com/drive/folders/${ch.pastaId}`,
            classe_documento: "chamado",
            chamado_numero: ch.chamadoNumero,
            chamado_pasta_id: ch.pastaId,
            chamado_rotulo: ch.lojaTexto,
            requerente: dadosGlpi?.requerente ?? null,
            tipo_detectado: "compra",
            ...dadosDetectados,
          });
          chamadosNovos++;
        } else {
          // REABERTURA (Opção A): atualiza o card existente com a nova leitura
          await supabase.from("caixa_entrada_boletos").update({
            requerente: dadosGlpi?.requerente ?? existente.requerente ?? null,
            ...dadosDetectados,
          }).eq("id", existente.id);

          // se o chamado já tinha sido lançado, atualiza a conta vinculada + registra histórico
          if (existente.status === "confirmado" && existente.lancamento_criado_id) {
            const { data: lanc } = await supabase.from("lancamentos").select("conta_id").eq("id", existente.lancamento_criado_id).maybeSingle();
            if (lanc?.conta_id) {
              await supabase.from("contas").update({
                numero_nf: nf?.numero_documento ?? null,
                remetente_cnpj: nf?.cnpj ?? null,
                destinatario_razao: nf?.destinatario ?? null,
                destinatario_cnpj: nf?.destinatario_cnpj ?? null,
                chave_acesso: nf?.chave_acesso ?? null,
              }).eq("id", lanc.conta_id);
              const novoValor = boleto?.valor ?? nf?.valor ?? null;
              if (novoValor != null) await supabase.from("lancamentos").update({ valor: novoValor }).eq("id", existente.lancamento_criado_id);
              await supabase.from("lancamento_historico").insert({
                lancamento_id: existente.lancamento_criado_id,
                de: "—",
                para: nf?.numero_documento ? `NF ${nf.numero_documento}` : "dados atualizados",
                comentario: "Atualização automática por reabertura do chamado",
                quem: null,
                em: new Date().toISOString(),
              });
            }
          }
          reaberturasAtualizadas++;
        }
      } catch (err: any) {
        erros.push(`Chamado ${ch.chamadoNumero ?? ch.pastaId}: ${err?.message ?? "erro"}`);
      }
    }
  } catch (err: any) {
    erros.push(`Varredura GLPI: ${err?.message ?? "erro"}`);
  }

  // ===== Compras Reenvio: reprocessa chamados que o usuário colocou pra reenvio =====
  let reenviosProcessados = 0, reenviosAtualizados = 0, reenviosNovos = 0;
  try {
    const reenvios = await listarReenviosGLPI(pastaId);
    if (reenvios.length > 0) {
      const { data: feitos } = await supabase.from("reenvio_processados").select("pasta_id, assinatura");
      const feitosMap = new Map((feitos ?? []).map((r: any) => [r.pasta_id, r.assinatura]));

      for (const ch of reenvios) {
        try {
          const pdfs = ch.arquivos.filter((a) => a.mimeType === "application/pdf" || /\.pdf$/i.test(a.name));
          const assinatura = pdfs.map((p) => p.id).sort().join(",");
          if (feitosMap.get(ch.pastaId) === assinatura) continue; // nada mudou nessa pasta de reenvio

          // lê TODAS as NFs desta pasta de reenvio
          const notas: any[] = [];
          for (const pdf of pdfs) {
            try {
              const buf = await baixarArquivoDoDrive(pdf.id);
              const ext = await extrairDadosBoleto(buf, pdf.name, pdf.mimeType);
              // aceita como NF se a IA classificou nota_fiscal OU se leu número da NF / chave de acesso
              const pareceNota = ext?.classe_documento === "nota_fiscal" || !!ext?.chave_acesso || !!ext?.numero_documento;
              if (ext && pareceNota) notas.push({ ext, pdf });
            } catch { /* arquivo ilegível: ignora, não derruba */ }
          }

          const dadosGlpi = ch.chamadoNumero ? await buscarDadosChamado(ch.chamadoNumero) : null;

          for (const { ext, pdf } of notas) {
            // procura conta já existente pela chave, ou por CNPJ + número da NF
            let existente: any = null;
            if (ext.chave_acesso) {
              const r = await supabase.from("contas").select("id").eq("chave_acesso", ext.chave_acesso).maybeSingle();
              existente = r.data;
            }
            if (!existente && ext.cnpj && ext.numero_documento) {
              const r = await supabase.from("contas").select("id").eq("remetente_cnpj", ext.cnpj).eq("numero_nf", ext.numero_documento).maybeSingle();
              existente = r.data;
            }

            // chamado_pasta_id sintético por NF, pra não colidir no índice único
            const idSintetico = `${ch.pastaId}#${ext.chave_acesso ?? ext.numero_documento ?? Math.random().toString(36).slice(2)}`;
            const baseCard = {
              drive_web_view_link: `https://drive.google.com/drive/folders/${ch.pastaId}`,
              classe_documento: "chamado",
              chamado_numero: ch.chamadoNumero,
              chamado_pasta_id: idSintetico,
              drive_file_id: idSintetico,
              chamado_rotulo: ch.lojaTexto,
              requerente: dadosGlpi?.requerente ?? null,
              tipo_detectado: "compra",
              fornecedor_detectado: ext.fornecedor ?? null,
              cnpj_detectado: ext.cnpj ?? null,
              destinatario_detectado: ext.destinatario ?? null,
              destinatario_cnpj_detectado: ext.destinatario_cnpj ?? null,
              chave_acesso: ext.chave_acesso ?? null,
              numero_documento_detectado: ext.numero_documento ?? null,
              emissao_ano: ext.data_emissao?.ano ?? null,
              emissao_mes: ext.data_emissao?.mes ?? null,
              emissao_dia: ext.data_emissao?.dia ?? null,
              valor_detectado: ext.valor ?? null,
              confianca: "media",
            };

            if (existente) {
              // NF já existe → NÃO atualiza sozinho. Cria um card pra o usuário
              // escolher: substituir o lançamento existente ou criar um novo.
              await supabase.from("caixa_entrada_boletos").insert({
                ...baseCard,
                nome_arquivo: `Reenvio · Chamado ${ch.chamadoNumero ?? "?"} · NF ${ext.numero_documento ?? ""} (já existe)`.trim(),
                conta_existente_id: existente.id,
                duplicada: true,
                observacao: `Atenção: essa NF já está lançada. Escolha substituir ou criar novo (chamado ${ch.chamadoNumero ?? ""}).`.trim(),
              });
              reenviosAtualizados++;
            } else {
              // NF nova → card normal de reenvio, para revisão e lançamento
              await supabase.from("caixa_entrada_boletos").insert({
                ...baseCard,
                nome_arquivo: `Reenvio · Chamado ${ch.chamadoNumero ?? "?"} · NF ${ext.numero_documento ?? ""}`.trim(),
                observacao: `Reenvio: nova NF do chamado ${ch.chamadoNumero ?? ""}`.trim(),
              });
              reenviosNovos++;
            }
          }

          await supabase.from("reenvio_processados").upsert({
            pasta_id: ch.pastaId, assinatura, chamado_numero: ch.chamadoNumero, em: new Date().toISOString(),
          });
          reenviosProcessados++;
        } catch (err: any) {
          erros.push(`Reenvio ${ch.chamadoNumero ?? ch.pastaId}: ${err?.message ?? "erro"}`);
        }
      }
    }
  } catch (err: any) {
    erros.push(`Varredura Reenvio: ${err?.message ?? "erro"}`);
  }

  // ===== Rede de segurança do Slack =====
  // O caminho normal é o arquivo do Slack ser lido em segundos, ainda dentro
  // da requisição do evento. Se aquilo falhar (função congelada, IA fora do
  // ar, Drive recusando), o item fica "pendente" na fila e é aqui que ele é
  // recuperado - sem precisar de um cron novo só pra isso.
  let slackRecuperados = 0;
  try {
    const r = await processarFilaSlack({ limite: 20 });
    slackRecuperados = r.processados;
    if (r.erros.length > 0) erros.push(...r.erros.map((e) => `Slack: ${e}`));
  } catch (err: any) {
    erros.push(`Fila do Slack: ${err?.message ?? "erro"}`);
  }

  // log da rodada
  await supabase.from("glpi_importacoes").insert({
    chamados_novos: chamadosNovos,
    documentos_lidos: docsChamado,
    pendentes_conferencia: pendentesConf,
    erros: erros.length > 0 ? erros : null,
  });

  return {
    ok: true as const,
    novos: processados,
    chamados: chamadosNovos,
    reaberturas: reaberturasAtualizadas,
    slack: slackRecuperados,
    erros: erros.length > 0 ? erros : undefined,
  };
}
