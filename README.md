# Magic Office Editor

Um editor de documentos para Windows 11 com revisão por inteligência artificial e controle sobre cada alteração.

**Versão 0.1.0 — beta.** Aplicativo desktop em português, com arquivos locais e revisão opcional. O projeto está em desenvolvimento; não pretende oferecer compatibilidade integral com o Microsoft Word.

## Baixar e instalar

1. Abra [Releases](https://github.com/ivanferrer/magic-office-editor/releases).
2. Na versão desejada, baixe **`Magic-Office-Editor-0.1.0-Setup.exe`** em **Assets**.
3. Execute o instalador e escolha a pasta de instalação.
4. Abra **Magic Office Editor** pelo menu Iniciar ou pelo atalho da área de trabalho.

**Você não precisa instalar Node.js, Git ou ferramentas de programação.** O instalador inclui o aplicativo e o runtime. Os arquivos `Source code (zip)` e `Source code (tar.gz)` são para desenvolvedores, não são instaladores.

O instalador beta não possui certificado de assinatura de código. O Windows pode exibir um aviso de editor desconhecido. Verifique a origem do download e o checksum SHA-256 publicado na mesma versão. A primeira publicação do instalador depende da conclusão do workflow em [Actions](https://github.com/ivanferrer/magic-office-editor/actions).

**Sistema-alvo:** Windows 11 x64. Não há instalador ARM64 nesta versão.

## O que já funciona

- Editor visual com negrito, itálico, sublinhado, tachado, fontes, tamanhos, cores e marca-texto.
- Títulos de três níveis, listas, alinhamento, espaçamento e recuos.
- Navegação pelos títulos, contagem de palavras/caracteres e zoom.
- Imagens locais PNG/JPEG/GIF, tabelas e links.
- Quebra de página, papel A4/Letter e margens configuráveis para saída.
- Abrir/salvar documentos `.magic`, importar `.docx` e `.txt`.
- Exportar `.docx`, `.pdf` e `.txt`; impressão com diálogo do sistema.
- Localizar e substituir todas as ocorrências com desfazer.
- Gravação atômica, backup `.magic.bak`, rascunhos automáticos e recuperação.
- IA para gramática, clareza ou estilo; revisão do documento ou da seleção.
- Aceitar ou ignorar sugestões individualmente; desfazer com `Ctrl+Z`.
- IA local via Ollama ou endpoint compatível com Chat Completions e JSON mode.

## Como configurar a IA

O editor abre e edita documentos sem configurar uma IA. **Nenhuma revisão é feita automaticamente.** O trecho só é enviado quando você clica em **Revisar**.

### Opção 1: Ollama no computador

1. Instale o [Ollama para Windows](https://ollama.com/download/windows).
2. Baixe um modelo pelo Ollama. Exemplo no terminal: `ollama pull qwen3:8b`.
3. No editor, abra **Configurar IA** e escolha **Ollama — no meu computador**.
4. Use `http://127.0.0.1:11434`, informe o nome exato do modelo instalado e clique em **Salvar e testar conexão**.

O aplicativo não inclui o Ollama nem os pesos de modelos no instalador. O download inicial requer internet; depois, um modelo local pode revisar sem enviar seu texto a um serviço remoto. Velocidade e qualidade dependem do modelo, da memória e da GPU. Você pode usar outro modelo disponível no seu computador que produza JSON adequadamente.

### Opção 2: serviço por API

1. Escolha **Serviço por API — compatível com OpenAI**.
2. Informe a URL-base, como `https://api.openai.com/v1`, o modelo e sua chave de API.
3. Salve e teste a conexão. Para revisar, o provedor deve aceitar `/chat/completions` com `response_format: { "type": "json_object" }`.

O botão de teste consulta a lista de modelos; isso verifica a conexão, mas não garante que todo modelo listado aceite o formato de revisão. O uso pode ser cobrado pelo provedor. A chave é armazenada com a proteção do sistema operacional (DPAPI no Windows); não é gravada dentro dos documentos, nem retornada ao painel depois de salva. Ao mudar o provedor/endereço, a chave anterior não é transferida automaticamente.

### Revisão sob seu controle

Selecione o trecho ou deixe o cursor sem seleção para revisar o documento. O limite é de **18.000 caracteres e 250 blocos por solicitação**, com até 120 segundos de espera. Para livros, revise por trechos ou capítulos. As instruções de estilo admitem até 1.000 caracteres.

As sugestões usam o texto original exato. Se você alterar o documento durante a consulta, a resposta será descartada. Sugestões pendentes têm suas posições atualizadas ao editar; se o trecho original mudar, a sugestão deixa de ser aplicável. A IA pode errar: confira o significado e os fatos antes de aceitar.

## Salvar, exportar e recuperar

O formato **`.magic`** é a cópia de trabalho que preserva a estrutura suportada pelo editor. DOCX/TXT importados abrem como cópias. Use **Salvar** para criar seu `.magic` e **Exportar** para compartilhar.

Rascunhos são gravados após 1,5 segundo de pausa na edição. O histórico mantém até 60 registros locais, com rotação aproximadamente a cada 30 segundos de edição. Não é um backup externo nem uma versão permanente a cada tecla. Em um encerramento abrupto, os últimos instantes de digitação podem ainda não ter sido gravados. **Histórico e recuperação** abre versões como novas cópias, sem sobrescrever o arquivo anterior.

Ao salvar novamente um `.magic`, a versão anterior fica no mesmo diretório com o sufixo `.bak`. Para recuperá-la manualmente, faça uma cópia desse backup, renomeie-a para terminar em `.magic` e abra a cópia.

## Limitações desta beta

- A área de edição é uma **folha contínua**. A paginação definitiva é gerada no PDF e na impressão, com contador no rodapé do PDF.
- DOCX usa conversão de conteúdo. Cabeçalhos, rodapés, notas de rodapé, seções, sumários automáticos, comentários, controle de alterações do Word, caixas de texto, colunas e diagramações complexas não têm preservação garantida.
- Revisões da IA não são exportadas como alterações controladas do Word; somente o texto aceito é exportado.
- Sem suporte a `.doc`, `.odt`, edição de PDF, macros ou colaboração em tempo real.
- Imagens: até 8 MB por arquivo. Documentos: até 30 MB. A exportação usa o subconjunto de estilos suportado; faça uma conferência antes de enviar para impressão.
- Modelos da IA são externos e configurados pelo usuário. A qualidade de revisão em livros extensos não foi avaliada; os testes automatizados usam um provedor local simulado.
- Sem atualizações automáticas nesta versão. Baixe o novo instalador em Releases quando houver atualização.

## Atalhos

| Atalho | Ação |
| --- | --- |
| Ctrl+N | Novo documento |
| Ctrl+O | Abrir |
| Ctrl+S | Salvar |
| Ctrl+Shift+S | Salvar como |
| Ctrl+F | Localizar e substituir |
| Ctrl+P | Imprimir |
| Ctrl+Z / Ctrl+Y | Desfazer / refazer |
| Ctrl+B / Ctrl+I / Ctrl+U | Negrito / itálico / sublinhado |

## Desenvolvimento

Requisitos: Node.js 22 ou superior e npm. Para gerar o instalador, use Windows x64 ou o workflow incluído.

```bash
git clone https://github.com/ivanferrer/magic-office-editor.git
cd magic-office-editor
npm ci
npm run dev
```

```bash
npm run check
npx playwright install chromium
npm run test:ui
npm run test:desktop
npm run dist:win
```

`test:desktop` precisa de ambiente gráfico e de `npm run build` concluído. No Linux sem interface, use um servidor gráfico de testes (como Xvfb); o aplicativo-alvo é Windows 11. O workflow executa testes de domínio e interface antes de gerar o instalador em Windows, testa o executável empacotado e publica a beta com checksum. Uma mudança de versão em `package.json` cria uma nova release; novas execuções da mesma versão substituem os arquivos dessa beta.

Saída: `release/Magic-Office-Editor-0.1.0-Setup.exe`.

## Estrutura

```text
electron/        Arquivos, conversão, impressão, IA e segurança no processo principal
src/components/  Barra de ferramentas, configurações e diálogos
src/editor/      Extensões de edição e posições das sugestões
src/shared/      Tipos e esquema do documento
tests/           Testes de domínio, interface e aplicativo empacotado
docs/            Arquitetura, privacidade e notas de versão
```

Veja [Arquitetura](docs/ARCHITECTURE.md), [Privacidade e segurança](docs/PRIVACY.md) e [Notas da versão](docs/RELEASE.md).

## Licença

MIT. Dependências e seus componentes mantêm suas respectivas licenças. Microsoft Word, OpenOffice, Ollama e OpenAI são nomes de seus respectivos titulares; este projeto é independente.
