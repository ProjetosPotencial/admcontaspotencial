export const money = (v: number | null | undefined) =>
  v == null
    ? "—"
    : "R$ " + Number(v).toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
