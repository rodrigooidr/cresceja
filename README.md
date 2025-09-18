# Cresceja

## IA da Organização

### Configurar o perfil de IA
1. Acesse **Configurações → IA da Organização** usando um usuário com permissão de administrador.
2. Defina o **segmento** que melhor representa o negócio. Caso nenhum segmento padrão se aplique, escolha "Outro" e escreva o nome manualmente.
3. Ajuste a **voz da marca** descrevendo tom, persona e tipo de linguagem que a IA deve adotar.
4. Informe os **idiomas aceitos** separados por vírgula (ex.: `pt-BR, en-US`). O primeiro idioma tem prioridade nas respostas.
5. Ative o **RAG** (base de conhecimento) quando quiser que a IA consulte documentos indexados. Configure também o número de trechos (`topK`) que devem ser considerados a cada resposta.
6. Em **Few-shot**, cadastre exemplos de conversas curtas que ilustrem o atendimento desejado. Esses exemplos ficam disponíveis na pré-visualização do prompt e são utilizados na sandbox.
7. Salve para publicar o perfil. Todas as alterações ficam disponíveis imediatamente para a sandbox e para os canais que usam o perfil ativo.

### Guardrails disponíveis
Os guardrails controlam o que chega até o modelo e o que pode ser enviado de volta ao cliente. O histórico fica em **Últimas violações**.

- **Bloqueio de tópicos sensíveis (pré-check)**: interrompe mensagens que contenham termos cadastrados (ex.: pedidos de desconto). Quando acionado, registra a violação e retorna a mensagem de recusa padrão.
- **Limite de caracteres (maxReplyChars)**: impede que a IA retorne respostas maiores do que o limite informado. Pode ser usado sozinho ou em conjunto com o pós-check.
- **Regra de pós-check – maxLength**: aplica um limite explícito para o tamanho da resposta gerada. Se o modelo exceder o limite, a resposta é substituída pela recusa e a violação é registrada.

Use o painel de violações para identificar entradas bloqueadas, revisar detalhes (entrada, resposta e estágio) e ajustar termos ou limites conforme necessário.

### Fontes do RAG e reindexação
1. Na seção **Fontes do RAG**, envie documentos (PDF, TXT ou planilhas) ou cadastre URLs que descrevem o negócio.
2. Cada upload ou URL cria um item na tabela `kb_documents`. Utilize tags e metadados quando precisar de filtros adicionais.
3. Ao atualizar um documento, clique em **Reindexar** para reconstruir o índice e disponibilizar as alterações para buscas semânticas.
4. Ajuste o `topK` no perfil para equilibrar precisão e velocidade — valores maiores retornam mais trechos de contexto.

### Chat de teste (sandbox)
1. Abra o bloco **Testar atendimento** e selecione o canal desejado (WhatsApp, Instagram, Facebook Messenger ou Widget Web).
2. Escreva a mensagem de teste e decida se deseja usar o **rascunho atual** ou o perfil publicado.
3. Opcionalmente, defina um horário para simular o atendimento em outro contexto (campo `Simular horário`).
4. Envie a mensagem e acompanhe o resultado:
   - **Resposta**: saída do modelo (ou a recusa em caso de violação).
   - **Debug**: tokens utilizados, chamadas de ferramentas, documentos do RAG considerados (com texto pré-visualizado) e eventuais violações.
5. Use esse fluxo para validar guardrails, contexto do RAG, exemplos few-shot e integrações antes de liberar o perfil para produção.
