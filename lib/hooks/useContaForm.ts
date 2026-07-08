import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ContaFormState {
  lojaId: string;
  tipo: string;
  fornecedor: string;
  identificador: string;
  vencimento: string;
  origem: string;
  login: string;
  senha: string;
  ehRateio: boolean;
  rateioDivisor: string;
}

export interface UseContaFormReturn {
  state: ContaFormState;
  setState: React.Dispatch<React.SetStateAction<ContaFormState>>;
  isLoading: boolean;
  error: string | null;
  success: boolean;
  salvar: () => Promise<{ id: string } | null>;
  resetForm: () => void;
  updateField: (field: keyof ContaFormState, value: string | boolean) => void;
}

const INITIAL_STATE: ContaFormState = {
  lojaId: "",
  tipo: "agua",
  fornecedor: "",
  identificador: "",
  vencimento: "",
  origem: "a_definir",
  login: "",
  senha: "",
  ehRateio: false,
  rateioDivisor: "2",
};

/**
 * Hook customizado para gerenciar o formulário de criação de contas.
 * Usado tanto na tela de Contas quanto na ficha de Loja, pra não duplicar
 * a lógica de validação, insert e credencial em dois lugares diferentes.
 */
export function useContaForm(lojaIdPadrao?: string): UseContaFormReturn {
  const supabase = createClient();
  const [state, setState] = useState<ContaFormState>({
    ...INITIAL_STATE,
    lojaId: lojaIdPadrao || "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateField = useCallback((field: keyof ContaFormState, value: string | boolean) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setError(null); // limpa erro ao usuário digitar
  }, []);

  const resetForm = useCallback(() => {
    setState({ ...INITIAL_STATE, lojaId: lojaIdPadrao || "" });
    setError(null);
    setSuccess(false);
  }, [lojaIdPadrao]);

  const salvar = useCallback(async (): Promise<{ id: string } | null> => {
    if (!state.lojaId) {
      setError("Selecione a loja.");
      return null;
    }
    if (!state.tipo) {
      setError("Selecione o tipo de conta.");
      return null;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: contaData, error: contaError } = await supabase
        .from("contas")
        .insert({
          loja_id: state.lojaId,
          tipo: state.tipo,
          fornecedor_nome: state.fornecedor.trim() || null,
          identificador: state.identificador.trim() || null,
          dia_vencimento: state.vencimento ? Number(state.vencimento) : null,
          origem: state.origem,
          eh_rateio: state.ehRateio,
          rateio_divisor: state.ehRateio ? Number(state.rateioDivisor) || null : null,
          situacao_cadastro: "aprovada",
          status: "ativo",
        })
        .select()
        .single();

      if (contaError) {
        setError("Não foi possível salvar a conta. Tente novamente.");
        setIsLoading(false);
        return null;
      }

      if (state.login.trim() || state.senha.trim()) {
        const { error: credError } = await supabase.rpc("credencial_salvar", {
          p_conta_id: contaData.id,
          p_login: state.login.trim() || null,
          p_senha: state.senha.trim() || null,
        });
        if (credError) {
          console.warn("Erro ao salvar credenciais:", credError);
          // não falha a operação inteira se a credencial não salvar
        }
      }

      setSuccess(true);
      setIsLoading(false);
      return { id: contaData.id };
    } catch {
      setError("Erro inesperado ao salvar a conta.");
      setIsLoading(false);
      return null;
    }
  }, [state, supabase]);

  return { state, setState, isLoading, error, success, salvar, resetForm, updateField };
}
