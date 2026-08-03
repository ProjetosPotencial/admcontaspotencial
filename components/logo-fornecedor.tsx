"use client";

// Mostra o logo do fornecedor. Se não houver logo, cai num avatar com as
// iniciais e uma cor derivada do nome (sempre a mesma cor pro mesmo nome).
function corDoNome(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

export default function LogoFornecedor({ nome, url, size = 32 }: { nome: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={nome} width={size} height={size}
        className="rounded-md object-contain bg-white border border-linha2 shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  const iniciais = (nome || "?").split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div className="rounded-md flex items-center justify-center font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: corDoNome(nome || "?"), fontSize: Math.round(size * 0.36) }}>
      {iniciais || "?"}
    </div>
  );
}
