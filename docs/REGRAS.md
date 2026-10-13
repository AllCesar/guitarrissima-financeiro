# Regras da Central Financeira — Guitarríssima

## Escopo
Substituir a operação da Lucro. Primeira fase: despesas e contas a pagar; receitas em etapa posterior.

## Dimensões de classificação
- Conta contábil/gerencial: natureza da despesa.
- Centro de custo: unidade ou área beneficiada.
- Projeto/evento: atividade específica, independente da natureza.
- Fornecedor e conta bancária são cadastros próprios, não subcontas da natureza.
- Rateios de uma obrigação devem somar exatamente seu valor em centavos.

## Entidades
Solicitação, documento fiscal, obrigação, parcela, alocação, pagamento, fornecedor, conta financeira, conta gerencial, centro de custo, projeto, usuário, evento de auditoria.

## Calendário financeiro
S1: dias 1–7; S2: 8–14; S3: 15–21; S4: 22–28; S5: 29–fim. Nunca S6.

## Segurança
Nenhuma credencial ou dado financeiro real em repositório. Pagamentos não são autorizados por este protótipo. Banco e serviço de homologação isolados. Migrations apenas após verificar o destino de DATABASE_URL.

## Importação Lucro
Importar primeiro para staging de dados, mapear categorias e sinalizar divergências. Não sobrescrever histórico e não presumir que classificações legadas estejam corretas.
