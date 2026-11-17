/**
 * Dados da entidade usados nas páginas legais (Termos e Privacidade).
 *
 * Campos vazios não são renderizados — evita publicar placeholder na tela.
 * Preencher `razaoSocial`/`cnpj` e `emailPrivacidade` antes de escalar a cobrança:
 * a LGPD (art. 41) pede um canal do encarregado e o CDC pede identificação do
 * fornecedor no site.
 */
export const LEGAL = {
  marca: "Talkion",
  site: "https://talkion.com.br",
  /** Canal de contato que já existe hoje: formulário da home. */
  contatoUrl: "/#contact",
  /** Preencher para exibir no rodapé das páginas legais. */
  razaoSocial: "",
  cnpj: "",
  emailPrivacidade: "",
  /** Data da última revisão do texto. */
  atualizadoEm: "13/11/2026",
} as const;

export const temDadosDaEmpresa = Boolean(LEGAL.razaoSocial || LEGAL.cnpj);
