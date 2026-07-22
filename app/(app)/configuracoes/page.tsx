import { createClient } from "@/lib/supabase/server";
import MenuAdminClient from "./menu-admin-client";
import CalendarioAdminClient from "./calendario-admin-client";
import TestarSlackButton from "./testar-slack-button";
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
        <p className="text-[14px] text-[#6c757d] mt-2.5">Sua conta neste sistema</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[720px]">
        <div className="card p-6">
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

        <div className="mt-8">
          <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Trocar senha</h2>
          <p className="text-[13px] text-[#6c757d] mb-4">Pede sua senha atual antes de trocar, por segurança.</p>
          <TrocarSenhaForm />
        </div>

        {ehAdmin && (
          <div className="mt-8">
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
          <div className="mt-8">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Menu do sistema</h2>
            <p className="text-[13px] text-[#6c757d] mb-4">Quem vê cada item, por papel mínimo. Só administradores acessam isto.</p>
            <MenuAdminClient itens={(menuItens ?? []) as any[]} />
          </div>
        )}

        {ehAdmin && (
          <div className="mt-8">
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
      </div>
    </>
  );
}