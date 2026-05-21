# Plano de Correção - Sidebar e Inputs Responsivos

## Problema 1: Sidebar - Informações do usuário subiram no desktop

**Arquivo:** `frontend/src/components/Sidebar.tsx:369`

**Causa:** `h-full` no container da sidebar resolve para altura do conteúdo (não viewport) 
porque o pai usa `min-h-[100dvh]` (min-height). Quando o conteúdo da página é menor que
a viewport, `flex-1` no nav não empurra o user info para o fundo.

**Correção:**
- Trocar `h-full` por `h-[100dvh]` e adicionar `overflow-hidden`:

```diff
- <div className="sticky top-0 hidden h-full w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
+ <div className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r bg-muted/30 overflow-hidden md:flex">
```

## Problema 2: Inputs quebrando na responsividade mobile

### 2a. Dashboard - Filtro de datas (dashboard/page.tsx:147-176)

**Problema:**
- Wrapper `div.grid.gap-1` aninhado no segundo input cria espaçamento inconsistente
- Label "Até" visível no mobile adiciona espaço extra que o primeiro input não tem
- Sem `min-w-0` nos containers para garantir que encolham

**Correção:** Simplificar para `flex` puro, remover wrapper, usar `aria-label` no input:

```diff
- <div className="grid w-full gap-3 sm:w-auto sm:flex sm:items-center">
-   <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_auto] sm:items-center">
+ <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
+   <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 sm:min-w-0">
      <Input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
-       className="w-full h-9 sm:w-auto"
+       className="h-9 w-full min-w-0 sm:w-auto"
+       aria-label="Data inicial"
      />
-     <span className="hidden text-sm text-muted-foreground sm:inline">até</span>
-     <div className="grid gap-1">
-       <span className="text-xs text-muted-foreground sm:hidden">Até</span>
+     <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">até</span>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
-         className="w-full h-9 sm:w-auto"
+         className="h-9 w-full min-w-0 sm:w-auto"
+         aria-label="Data final"
        />
-     </div>
    </div>
    <Button ...>Filtrar</Button>
  </div>
```

### 2b. Admin - Filtro de datas (admin/page.tsx:149-177)

**Problema:** Mesma estrutura aninhada do dashboard.

**Correção:** Mesma abordagem - simplificar para `flex` puro:

```diff
- <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_auto] sm:items-center">
+ <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 sm:min-w-0">
    <Input
      type="date"
      value={fromDate}
      onChange={(e) => setFromDate(e.target.value)}
-     className="w-full sm:w-36"
+     className="h-9 w-full min-w-0 sm:w-auto"
      aria-label="De"
    />
-   <span className="hidden text-muted-foreground sm:inline">até</span>
-   <div className="grid gap-1">
-     <span className="text-xs text-muted-foreground sm:hidden">Até</span>
+   <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">até</span>
      <Input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
-       className="w-full sm:w-36"
+       className="h-9 w-full min-w-0 sm:w-auto"
        aria-label="Até"
      />
-   </div>
  </div>
```

### 2c. Automation - Inputs de horário (automation/page.tsx:417)

**Problema:** `sm:grid-cols-2` entre 640-768px deixa labels longos apertados.

**Correção:** Mudar para `md:grid-cols-2`:

```diff
- <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
+ <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
```

### 2d. Automation - w-32 shrink-0 (automation/page.tsx:566)

**Problema:** `w-32 shrink-0` no select de nível força overflow em telas <400px.

**Correção:** Permitir que o select encolha em telas muito estreitas:

```diff
- <div className="w-32 shrink-0">
+ <div className="min-w-0 shrink md:w-32">
```
