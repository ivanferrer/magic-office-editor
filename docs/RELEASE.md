# Magic Office Editor 0.1.0 — beta

Editor desktop em português para Windows 11 x64.

## Instalação

Baixe **Magic-Office-Editor-0.1.0-Setup.exe** nos arquivos desta versão e execute o instalador. Não é necessário Node.js ou ferramentas de programação. Os downloads de código-fonte não são o instalador.

O aplicativo é uma beta sem assinatura de código; o Windows pode identificar o editor como desconhecido. Confira o SHA-256 em `SHA256SUMS.txt`.

## Incluído

- Editor com estilos de texto, títulos, listas, tabelas, imagens e links.
- Documentos `.magic`, importação DOCX/TXT e exportação DOCX/PDF/TXT.
- Impressão, salvamento com backup, rascunhos e recuperação.
- Revisão por IA com propostas individuais para aceitar/ignorar, preservação de posições e desfazer.
- Ollama local ou serviço por API configurável.

## Para usar a IA

Configure um provedor em **Configurar IA**. A instalação de Ollama e o download do modelo são separados; serviços por API exigem credenciais e podem cobrar pelo uso. Nenhuma chave ou conta está incluída no instalador. O editor funciona sem IA.

## Limitações

DOCX tem conversão parcial e pode mudar a diagramação avançada. A edição é contínua; a paginação final está no PDF/na impressão. Sem DOC, ODT, macros, colaboração, comentários persistentes ou controle de alterações do Word. Para textos longos, revise até 18 mil caracteres por vez.

Os testes automatizados cobrem o editor, arquivos, exportação e protocolo da IA com um provedor simulado. A qualidade das sugestões de modelos reais depende do provedor e deve ser conferida pelo usuário.
