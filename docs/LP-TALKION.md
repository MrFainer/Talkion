# LP do Talkion (`/lp`)

Status: **implementada na branch `feat/lp-talkion`** (aguardando revisão). Não está no ar.

## 1. Objetivo

Página de conversão para tráfego pago, separada da home institucional (`/`), com **um** objetivo:
fazer o professor criar conta no plano Free.

- **Público**: professor de idiomas (autônomo e escola). É o ICP dos planos já vendidos na home.
- **CTA principal**: `/login?register=true&plan=Free` (deep link que já abre a tela de cadastro — o
  `/login` já lê `register=true` e o tracking de `REGISTER` já existe).
- **CTA secundário**: "Ver como funciona" (âncora) e "Falar com especialista" → `/#contact` na home.

## 2. Por que rota separada e não refazer a home

A home já é uma LP completa e está no ar (`talkion.com.br`, 200). Mexer nela significa deploy em
produção para testar hipótese de conversão. Em `/lp` a página nasce isolada: dá para rodar tráfego,
comparar com a home e decidir depois qual fica na raiz.

## 3. Estrutura (ordem de conversão)

1. **Header** fixo — navegação por âncora + "Entrar" + "Começar grátis". Sobre o hero escuro ele é
   claro; ao rolar vira a barra branca.
2. **Hero** — promessa ("Seus alunos praticam todo dia. Você não prepara nada."), subhead com o
   mecanismo, dois CTAs, garantias (sem cartão, 2.000 créditos, até 3 alunos) e **mockup da conversa
   no WhatsApp** (notícia → quiz → áudio → feedback da IA).
3. **Faixa de números** — 100% WhatsApp · 24/7 · 8 idiomas · 20h+ por semana (números que já estão
   publicados na home).
4. **Problema** — fábrica de conteúdo, seis dias de silêncio, falta de número de evolução.
5. **Como funciona** — 4 passos, do cadastro ao primeiro áudio corrigido.
6. **Recursos** — 6 blocos (notícia diária, speaking por IA, quiz com gabarito no ciclo seguinte,
   fluxo privado/grupo, 8 idiomas, dashboard).
7. **Para quem é** — professor autônomo, escola/curso, qualquer idioma.
8. **Planos** — Free, Essentials, Professional (destaque) e School, com os **preços reais** da home;
   linha de Enterprise e link para a tabela comparativa da home.
9. **Depoimentos** — os três primeiros depoimentos já publicados na home.
10. **FAQ** — 6 perguntas (instalação, prazo do grátis, paridade de planos, créditos, troca de plano,
    idiomas).
11. **CTA final + rodapé** + **barra fixa de CTA no celular**.

Referência de estrutura: hero → prova → problema → solução → prova social → planos → FAQ → CTA
(getspike.ai/blog/saas-landing-page-best-practices, inbuild.io/guides/saas-landing-page — consultadas
em 24/10/2026).

## 4. Design

- Identidade do produto é **monocromática** (o logo é um balão de fala com waveform, preto). A LP segue
  preto/branco com **um** acento: verde de "conversa".
- Acento entrou como **token semântico** em `globals.css`: `--brand`, `--brand-foreground`,
  `--brand-muted` (mapeados em `@theme inline`). Nenhuma cor crua nas telas novas; o resto usa
  `background/foreground/card/muted/border/primary`.
- Números e textos em **pt-BR** (`R$ 99,90`), rótulo de tela sempre em português; conteúdo em inglês
  só dentro do mockup da conversa (é o material que o aluno recebe).

## 5. Integrações tocadas

| Arquivo | Mudança | Por quê |
|---|---|---|
| `src/app/lp/page.tsx` | novo | Server component só com `metadata` (title, description, canonical, OG) |
| `src/components/lp/*` | novo | Header, hero, mockup, seções, fechamento, `data.ts` |
| `src/components/ProtectedRoute.tsx` | `publicRoutes` += `"/lp"` | sem isso o visitante anônimo é redirecionado para `/login` |
| `src/components/AppShell.tsx` | `PUBLIC_ROUTES` += `"/lp"` | idem (evita renderizar a casca do painel) |
| `src/app/globals.css` | +3 tokens de marca | acento único em vez de paleta crua |

Tracking: `trackSiteVisit("HOME")` (o tipo do backend só tem `HOME|LOGIN|REGISTER`; a rota é gravada
no campo `path`, então a visita a `/lp` fica identificada).

## 6. O que NÃO foi feito (de propósito)

- Sem alteração na home (`/`), no backend, no schema ou nas variáveis de ambiente.
- Sem deploy. Publicar = merge na `main` + redeploy no Coolify.
- Sem link para `/lp` na home ou no menu do painel (decisão de produto: só depois de aprovar a página).

## 7. Pendências e decisões do dono

1. **Linkar a LP?** Recomendo deixar `/lp` só para campanha (sem link interno) e manter a home como
   entrada orgânica.
2. **Preços em dois lugares**: `data.ts` da LP repete os preços da home. Preço novo exige mudar os
   dois. Recomendo, num próximo passo, extrair para um módulo único e a home importar dele.
3. **Domínio**: se a campanha exigir URL própria (ex.: `lp.talkion.com.br`), é um app novo no Coolify
   apontando para a mesma branch — a rota já está pronta.
