# Homologação e segurança

## Condições para liberar operação real
1. Criar PostgreSQL **exclusivo** da Central Financeira, com backup e retenção adequados.
2. Configurar DATABASE_URL no serviço de homologação, sem divulgar credenciais.
3. Confirmar nome e identidade do banco antes de executar db/0001_initial.sql.
4. Aplicar migrations **somente** em homologação, por processo controlado.
5. Configurar API_TOKEN com 32+ caracteres aleatórios e armazenamento em segredo no Render.
6. Implementar autenticação por usuário e RBAC antes de liberar uso real; token único é provisório para desenvolvimento.
7. Substituir dados fictícios por cadastros validados e realizar conciliação paralela com a Lucro.
8. Testar rateios, parcelas, pagamentos parciais, permissões, restauração de backup e auditoria.

## Estado atual
API em desenvolvimento. Sem banco, endpoints de negócio devolvem 503; sem token, devolvem 401. Não configurar o serviço como produção.
