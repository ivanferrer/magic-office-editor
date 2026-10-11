# Arquitetura

## Escolhas

- **Electron**: janela desktop, diálogos nativos, impressão, PDF e integração com armazenamento seguro.
- **React + TypeScript + Vite**: interface em português e compilação do renderer.
- **Tiptap / ProseMirror**: documento estruturado, edição com transações e histórico de desfazer.
- **Mammoth**: importação semântica de DOCX; HTML resultante passa por DOMPurify antes da inserção.
- **docx**: geração explícita dos recursos DOCX suportados.
- **Ollama / API compatível**: adaptadores independentes da interface, resposta JSON validada.

## Fronteiras

O renderer é sandboxed, sem Node.js, com context isolation e CSP. O preload expõe apenas métodos específicos. A interface nunca recebe acesso genérico a `fs`, `ipcRenderer`, shell ou execução de comandos. O processo principal valida origem do IPC e entradas, escolhe os caminhos com diálogos nativos e guarda o caminho ativo internamente.

O arquivo `.magic` é JSON UTF-8 com identificador de formato, versão, título, documento ProseMirror, configuração de página e data de edição. Imagens são data URLs. A validação rejeita versões desconhecidas. Gravação usa arquivo temporário e rename, mantendo backup quando salva um `.magic` existente. O histórico é uma fila serial de snapshots com retenção de 60 registros; não é um armazenamento permanente.

## Revisão

1. O renderer coleta blocos de texto, seus identificadores e suas posições no documento.
2. Envia ao processo principal apenas texto, modo de revisão e preferências.
3. O adaptador usa as credenciais guardadas, solicita JSON e aplica limites de tamanho e duração.
4. A resposta só admite sugestões que correspondam exatamente a uma ocorrência no bloco. Sobreposições são descartadas.
5. O renderer associa intervalos às sugestões; transações subsequentes atualizam suas posições.
6. Antes da aceitação, o texto atual é comparado ao original. A substituição é uma transação de texto literal, preservando o restante e podendo ser desfeita.

O mecanismo não executa ferramentas nem ações sugeridas pelo modelo. A resposta do modelo não é interpretada como HTML. Revisões terminadas depois de alterações no documento são descartadas. Limites: 18 mil caracteres de entrada, 250 blocos, 80 propostas no validador, resposta HTTP de até 2 MB e 120 segundos por solicitação.

## Impressão e PDF

Uma janela efêmera, oculta e isolada recebe HTML sanitizado, sem scripts, fontes remotas ou imagens externas. CSS define papel, margens, quebras e estilos básicos. A janela aguarda fontes e imagens locais antes da saída. Depois da exportação/impressão, a janela e o HTML temporário são removidos. A renderização de página do Word pode diferir dessa saída.

## Verificação

- Testes unitários: esquema, gravação com backup, recuperação, validação de sugestões e conversão DOCX reimportável.
- Teste de contrato: adaptadores fazem chamadas HTTP a um servidor local de teste, verificando protocolo e parsing.
- Playwright na interface: formatação, salvamento, confirmação de alterações, revisão, atualização de posições, desfazer e substituição.
- Playwright Electron no Windows: inicia o executável empacotado e verifica IPC, arquivo nativo, DOCX, PDF, recuperação e revisão com servidor simulado.

Esses testes não substituem ensaios de usabilidade nem garantem fidelidade com todos os documentos Word. Não há teste pago ou transmissão de texto a uma conta real de IA na integração contínua.

## Próximos incrementos

Paginação visual, testes com acervo de documentos complexos, estilos de documento, comentários persistentes, gestão de capítulos longos, importação ODT, assinatura de código e atualizações assinadas. Esses itens são planejados e não fazem parte da beta.
