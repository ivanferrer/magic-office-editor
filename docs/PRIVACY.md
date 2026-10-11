# Privacidade e segurança

- Documentos são gravados somente nos caminhos escolhidos. Rascunhos e configuração ficam na pasta `userData` do Electron, dentro do perfil do usuário (normalmente `%APPDATA%/Magic Office Editor` no Windows).
- Documentos e rascunhos **não são criptografados pelo aplicativo**. Use as proteções de conta/disco do Windows para arquivos confidenciais.
- Não há telemetria, publicidade ou sincronização de documentos nesta versão.
- A revisão transmite o texto selecionado ou os blocos do documento apenas quando solicitada. O endpoint é visível nas configurações. Ollama em `localhost` processa no computador; um endpoint remoto segue a política daquele operador.
- Chaves de API são cifradas por `safeStorage` no processo principal; no Windows, usam a proteção do sistema operacional. Isso não protege contra malware com acesso à mesma conta. Nenhuma chave é incluída no Git, documento ou renderer depois do salvamento.
- Endpoints remotos exigem HTTPS; HTTP só é permitido em loopback. Redirecionamentos HTTP são recusados para evitar encaminhar credenciais para outro destino.
- O renderer não faz chamadas diretas à IA. Janelas extras, navegação arbitrária, webviews e pedidos de permissões são bloqueados.
- DOCX é tratado como entrada não confiável: referências a arquivos externos são desativadas; HTML importado e colado é sanitizado. Macros não são executadas.
- A impressão usa uma janela isolada com CSP própria e conteúdo sanitizado. Imagens externas não são carregadas.
- A correção ortográfica do Chromium pode precisar baixar o dicionário do idioma. A função de IA é separada desse corretor.

## Dependências

O lockfile fixa as versões usadas. Execute `npm audit` periodicamente e atualize dependências com testes. Na criação da beta, a análise do npm relatou um aviso moderado em `sprintf-js`, dependência da interface de linha de comando de Mammoth via `argparse`. O aplicativo usa a API de conversão de Mammoth e não chama essa interface de linha de comando. Não foi aplicada uma substituição incompatível de dependência apenas para suprimir o aviso; acompanhe a correção upstream.

## Distribuição beta

O instalador inicial não é assinado com certificado comercial. A compilação do GitHub Actions gera SHA-256 para conferência. Não há autoatualização remota. Faça backup dos documentos importantes antes de testar versões beta.
