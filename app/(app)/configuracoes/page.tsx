import { createClient } from "@/lib/supabase/server";
import MenuAdminClient from "./menu-admin-client";
import CalendarioAdminClient from "./calendario-admin-client";
import TestarSlackButton from "./testar-slack-button";
import TestarDriveButton from "./testar-drive-button";
import TestarSlackEntradaButton from "./testar-slack-entrada-button";
import TestarGlpiButton from "./testar-glpi-button";
import TestarLeituraIaButton from "./testar-leitura-ia-button";
import TrocarSenhaForm from "./trocar-senha-form";
import { podeAcessar, SemPermissao } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  if (!(await podeAcessar("/configuracoes"))) return <SemPermissao modulo="Configurações" />;
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const { data: perfil } = await supabase.from("perfis").select("nome, email, papel, ativo, created_at").eq("id", user?.id).single();

  const ehAdmin = perfil?.papel === "admin";
  const anoAtual = new Date().getFullYear();
  const [{ data: feriados }, { data: cfgCal }] = ehAdmin
    ? await Promise.all([
        supabase.from("feriados").select("id, data, nome, escopo, uf, municipio, facultativo").order("data"),
        supabase.from("config_calendario").select("regra_vencimento, considerar_facultativos").eq("id", 1).maybeSingle(),
      ])
    : [{ data: [] as any[] }, { data: null as any }];

  const { data: menuItens } = ehAdmin
    ? await supabase.from("menu_itens").select("id, label, href, papel_minimo, ativo, ordem").order("ordem")
    : { data: null };

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Configurações</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Sua conta e as integrações do sistema</p>
        <div className="flex flex-wrap gap-2 mt-5">
          {[
            { id: "conta", label: "Minha conta" },
            { id: "seguranca", label: "Segurança" },
            ...(ehAdmin ? [{ id: "calendario", label: "Calendário" }, { id: "menu", label: "Menu" }] : []),
            { id: "drive", label: "Google Drive" },
            { id: "glpi", label: "GLPI" },
            { id: "ia", label: "IA" },
            { id: "slack", label: "Slack" },
          ].map((s) => (
            <a key={s.id} href={`#${s.id}`} className="px-3.5 py-1.5 rounded-full text-[12.5px] bg-white border border-linha2 text-txt-2 hover:border-txt-3 hover:text-txt transition">
              {s.label}
            </a>
          ))}
        </div>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[720px]">
        <div id="conta" className="card p-6 scroll-mt-20">
          <div className="grid grid-cols-2 gap-y-4">
            <div>
              <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">Nome</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">{perfil?.nome ?? "—"}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">Papel</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a] capitalize">{perfil?.papel ?? "—"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">E-mail</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">{perfil?.email ?? user?.email}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">Status</div>
              <span className={`badge ${perfil?.ativo ? "bg-ok-bg text-ok" : "bg-[#f1f3f5] text-[#adb5bd]"}`}>{perfil?.ativo ? "Ativo" : "Inativo"}</span>
            </div>
            <div>
              <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">Membro desde</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">
                {perfil?.created_at ? new Date(perfil.created_at).toLocaleDateString("pt-br") : "—"}
              </div>
            </div>
          </div>
        </div>
        <p className="text-[12px] text-[#adb5bd] mt-4">Pra trocar seus dados (nome, e-mail), peça ao administrador do sistema.</p>

        <div id="seguranca" className="mt-8 scroll-mt-20">
          <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Trocar senha</h2>
          <p className="text-[13px] text-[#6c757d] mb-4">Pede sua senha atual antes de trocar, por segurança.</p>
          <TrocarSenhaForm />
        </div>

        {ehAdmin && (
          <div id="calendario" className="mt-8 scroll-mt-20">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Calendário de dias úteis</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">
              Define o que acontece com vencimento em dia não útil e quais feriados valem para cada praça.
            </p>
            <CalendarioAdminClient
              feriados={(feriados ?? []) as any[]}
              regra={(cfgCal?.regra_vencimento ?? "adiar") as any}
              facultativos={!!cfgCal?.considerar_facultativos}
              ano={anoAtual}
            />
          </div>
        )}

        {ehAdmin && (
          <div id="menu" className="mt-8 scroll-mt-20">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Menu do sistema</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Quem vê cada item, por papel mínimo. Só administradores acessam isto.</p>
            <MenuAdminClient itens={(menuItens ?? []) as any[]} />
          </div>
        )}

        {ehAdmin && (
          <div id="drive" className="mt-8 scroll-mt-20">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Conexão com o Google Drive</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Verifica se o sistema consegue acessar o Drive, mostra com qual conta está conectado e se as pastas de entrada e saída estão acessíveis. Não faz upload nem varredura — só testa.</p>
            <TestarDriveButton />
          </div>
        )}

        {ehAdmin && (
          <div id="glpi" className="mt-8 scroll-mt-20">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Conexão com o GLPI</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Verifica se o sistema autentica na API do GLPI (App-Token + User-Token) e consegue ler a sessão. Mostra o erro exato se falhar — útil pra confirmar os tokens e a liberação de IP do cliente de API.</p>
            <TestarGlpiButton />
          </div>
        )}

        {ehAdmin && (
          <div id="ia" className="mt-8 scroll-mt-20">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Testar leitura por IA</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Suba uma nota (PDF ou imagem) para ver o que a IA extrai — a leitura da Anthropic e a conferência da NVIDIA lado a lado. Serve pra validar a leitura sem depender de importar um chamado.</p>
            <TestarLeituraIaButton />
          </div>
        )}

        {ehAdmin && (
          <div id="slack" className="mt-8 scroll-mt-20">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Notificação diária no Slack</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Testa agora, sem esperar o horário agendado. Manda de verdade pro canal configurado.</p>
            <TestarSlackButton endpoint="/api/notificar-slack/testar" />
          </div>
        )}

        {ehAdmin && (
          <div className="mt-8">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Resumo semanal no Slack</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Lançado e aprovado nos últimos 7 dias, mais o ranking de lojas com mais atraso. Roda sozinho toda segunda de manhã.</p>
            <TestarSlackButton endpoint="/api/notificar-slack-semanal/testar" />
          </div>
        )}

        {ehAdmin && (
          <div className="mt-8">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Recebimento de boletos pelo Slack</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Confere token, assinatura, canal e se o bot foi convidado — sem postar nada no canal. É o caminho da loja mandar o PDF e ele cair na Caixa de Entrada.</p>
            <TestarSlackEntradaButton />
          </div>
        )}
      </div>
    </>
  );
}