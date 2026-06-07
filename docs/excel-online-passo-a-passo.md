# Integracao App -> Supabase -> Excel Online

Objetivo: ao marcar figurinhas no app, os faltantes sobem automaticamente para o Supabase. No Excel Online, um fluxo do Power Automate busca esses faltantes e pinta a planilha.

## 1) Banco no Supabase

Execute este SQL no SQL Editor do Supabase:

create table if not exists public.excel_missing_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  missing_codes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.excel_missing_states enable row level security;

create policy "owner can read missing state"
on public.excel_missing_states
for select
to authenticated
using (auth.uid() = user_id);

create policy "owner can upsert missing state"
on public.excel_missing_states
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

Observacao:
- O app ja foi ajustado para gravar automaticamente nessa tabela.
- Campo salvo: missing_codes (lista de codigos faltantes).

## 2) Estrutura no Excel Online

No arquivo do Excel Online, na aba de controle (exemplo: Impressao PB), os codigos devem estar em celulas como MEX01, BRA14, FWC03, 00.

## 3) Criar Office Script

No Excel Online:
- Automate
- New Script
- Cole o script abaixo
- Salve como: AtualizarFaltantesOnline

function main(workbook: ExcelScript.Workbook, missingCodesCsv: string) {
  const sheet = workbook.getWorksheet("Impressao PB");
  if (!sheet) {
    throw new Error("Aba Impressao PB nao encontrada.");
  }

  const used = sheet.getUsedRange();
  if (!used) {
    return;
  }

  const values = used.getValues();
  const rows = values.length;
  const cols = rows > 0 ? values[0].length : 0;

  const missingSet = new Set(
    (missingCodesCsv || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter((x) => x.length > 0)
  );

  const codeRegex = /^(00|FWC\d{2}|CC\d{2}|[A-Z]{3}\d{2})$/;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const raw = values[r][c];
      const code = String(raw ?? "").trim().toUpperCase();

      if (!codeRegex.test(code)) {
        continue;
      }

      const cell = used.getCell(r, c);

      if (missingSet.has(code)) {
        cell.getFormat().getFill().clear();
        cell.getFormat().getFont().setBold(false);
      } else {
        cell.getFormat().getFill().setColor("#CCFFCC");
        cell.getFormat().getFont().setBold(true);
      }
    }
  }
}

## 4) Criar fluxo no Power Automate

### 4.1 Criar fluxo
- Create
- Scheduled cloud flow
- Exemplo: a cada 5 minutos

### 4.2 Buscar faltantes no Supabase
Use uma acao HTTP:
- Method: GET
- URI: https://SEU_PROJETO.supabase.co/rest/v1/excel_missing_states?select=missing_codes,updated_at&user_id=eq.USER_ID_DO_APP
- Headers:
  - apikey: SUA_SUPABASE_ANON_KEY
  - Authorization: Bearer SUA_SUPABASE_ANON_KEY
  - Accept: application/json

Observacao:
- USER_ID_DO_APP e o id do usuario autenticado no app.
- Se quiser multiusuario, crie um fluxo por usuario ou adicione uma camada intermediaria.

### 4.3 Converter array em CSV
Adicione Compose com expressao:
join(first(body('HTTP'))?['missing_codes'], ',')

### 4.4 Rodar Office Script
Acao: Excel Online (Business) -> Run script
- Arquivo: sua planilha
- Script: AtualizarFaltantesOnline
- Parametro missingCodesCsv: saida do Compose

## 5) Validacao

- Abra o app e marque/desmarque algumas figurinhas.
- Aguarde o intervalo do fluxo.
- Abra/recarregue o Excel Online.
- As figurinhas que voce ja tem ficam verdes; faltantes ficam sem preenchimento.

## 6) Solucao de problemas

- Tabela nao existe:
  - rode o SQL da secao 1.
- Fluxo HTTP falha:
  - confira URL, apikey e Authorization.
- Script nao pinta:
  - confirme o nome da aba Impressao PB.
  - confirme formato dos codigos nas celulas.
- Nada atualiza:
  - verifique se o app esta logado e sincronizando na nuvem.
