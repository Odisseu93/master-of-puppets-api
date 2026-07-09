# Master of Puppets API (Execução de Shell Scripts via API)
<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/3b58ec43-3469-4bd7-b5f8-2cbc94563042" />




Esta é uma API desenvolvida com **Node.js**, **VkrunJS** e **TypeScript** cuja principal funcionalidade é executar arquivos de shell script pré-existentes na máquina host de forma segura. A autenticação é controlada por API Keys individuais persistidas em um banco SQLite e gerenciadas localmente através de uma CLI offline.

---

## 🚀 Funcionalidades Principais

- **Execução de Scripts em Background (Assíncrona)**: Inicia scripts de shell da máquina host sem travar a requisição HTTP.
- **Consulta de Logs e Status (Polling)**: Rota dedicada para obter o status da execução (`running`, `completed` ou `failed`), exit code, `stdout` e `stderr` completos.
- **Autenticação via API Key**: Header `x-api-key` obrigatório para acesso às rotas de execução e consulta.
- **Segurança Reforçada**:
  - **Directory Traversal Guard**: Impede a execução de arquivos fora do diretório homologado (bloqueia caminhos como `../../etc/passwd`).
  - **Hashing de Chaves**: As chaves são hasheadas com SHA-256 antes da persistência no banco (a chave em texto plano nunca fica gravada).
  - **Expiração e Revogação**: Suporte a data de expiração opcional para chaves e revogação imediata.
  - **Rate Limiting**: Middleware de limitação de requisições integrado para prevenir abusos.

---

## 🛠️ Requisitos e Configuração

### Requisitos do Sistema
- Node.js >= 20.x

### Instalação
Clone o repositório, instale as dependências e crie o diretório de scripts:

```bash
# Instalar dependências
npm install

# Criar a pasta onde ficarão armazenados os shell scripts homologados
mkdir host-scripts
```

### Variáveis de Ambiente e Configuração (`.env`)

A aplicação gerencia e valida as variáveis de ambiente utilizando o recurso `loadEnv` e o módulo de validação de schemas do **VkrunJS**. As variáveis são validadas e tipadas no momento da inicialização da API.

Para alterar as configurações padrão, crie um arquivo `.env` na raiz do projeto contendo as seguintes variáveis:

```env
PORT=3000
DATABASE_PATH=database.sqlite
SCRIPTS_DIR=./host-scripts
LOG_LEVEL=info
CORS_ORIGIN=*
```

| Variável | Tipo | Valor Padrão | Descrição |
|---|---|---|---|
| `PORT` | Número | `3000` | Porta onde o servidor HTTP ficará ouvindo. |
| `DATABASE_PATH` | Texto | `database.sqlite` | Caminho do arquivo SQLite (use `:memory:` para banco em memória nos testes). |
| `SCRIPTS_DIR` | Texto | `./host-scripts` | Diretório contendo os scripts de shell autorizados para execução. |
| `LOG_LEVEL` | Texto | `info` | Nível mínimo de log do Pino Logger (`info`, `warn`, `error`, `debug`). |
| `CORS_ORIGIN` | Texto | `*` | Origens autorizadas pelo middleware de CORS. Aceita wildcard global (`*`), origens específicas separadas por vírgula (ex: `http://localhost:3000,https://meusite.com`) ou padrões de subdomínio wildcard (ex: `https://*.amazon.com`). |

---

## 🔑 Gerenciamento Offline de API Keys (CLI)

Para manter o fluxo offline e seguro, o gerenciamento de chaves é feito via terminal no ambiente do host:

```bash
npm run manage-keys
```

O comando abrirá um menu interativo com as seguintes opções:

1. **Gerar Nova API Key**: Solicita um nome/descrição e o tempo de expiração em dias (deixe em branco para expiração indeterminada). A chave secreta será exibida **apenas uma vez** no console no formato `sk_live_[prefixo].[segredo]`.
2. **Revogar API Key**: Lista as chaves ativas e permite invalidar uma delas imediatamente a partir de seu ID.
3. **Listar API Keys**: Exibe uma tabela com o ID, nome, prefixo, data de criação, expiração e status atual (Ativa, Revogada ou Expirada) de todas as chaves.
4. **Sair**: Fecha a ferramenta e encerra a conexão com o banco.

---

## 📌 Versionamento da API

A API adota práticas recomendadas de versionamento para garantir a estabilidade das integrações e prevenir quebras de compatibilidade (breaking changes) para os clientes:

1. **Versionamento via URI (URI Path Versioning)**: As rotas protegidas da API são prefixadas com a versão principal (ex: `/v1/executions`). Caso alterações incompatíveis sejam introduzidas no futuro (como modificações na estrutura de dados ou novos parâmetros obrigatórios), uma nova versão será disponibilizada (ex: `/v2/executions`), mantendo a versão anterior ativa para evitar quebras.
2. **Versionamento Semântico (SemVer)**: O ciclo de vida do desenvolvimento no código fonte segue o padrão SemVer (`MAJOR.MINOR.PATCH` no `package.json`):
   - **MAJOR** (bumping para `2.0.0`): Alterações que quebram a compatibilidade da API.
   - **MINOR** (bumping para `1.1.0`): Adição de novas rotas ou parâmetros opcionais retrocompatíveis.
   - **PATCH** (bumping para `1.0.1`): Correção de bugs ou melhorias internas que não afetam a API pública.

---

## 🔌 API Endpoints

### 1. Iniciar Execução de Script
Executa um script de shell contido na pasta homologada em segundo plano.

- **URL:** `/v1/executions`
- **Método:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `x-api-key: sk_live_3b827c9f.02a439c7...` (Sua chave gerada)
- **Corpo da Requisição (JSON):**
  ```json
  {
    "script": "backup-db.sh",
    "arguments": ["--compress", "production"]
  }
  ```
- **Respostas:**
  - `202 Accepted` (Execução iniciada com sucesso):
    ```json
    {
      "id": "8078484c-9065-4bcb-bcf2-1053f5a17763",
      "status": "running"
    }
    ```
  - `400 Bad Request` (Nome do script inválido ou tentativa de Directory Traversal):
    ```json
    {
      "error": "Acesso negado: directory traversal detectado."
    }
    ```
  - `401 Unauthorized` (Chave inválida, expirada ou ausente).

---

### 2. Consultar Status e Logs da Execução
Obtém o status de uma tarefa e recupera as saídas do terminal.

- **URL:** `/v1/executions/:id`
- **Método:** `GET`
- **Headers:**
  - `x-api-key: sk_live_3b827c9f.02a439c7...`
- **Respostas:**
  - `200 OK` (Dados da tarefa):
    ```json
    {
      "id": "8078484c-9065-4bcb-bcf2-1053f5a17763",
      "script_name": "backup-db.sh",
      "arguments": ["--compress", "production"],
      "status": "completed",
      "exit_code": 0,
      "stdout": "Iniciando backup...\nCompactando arquivos...\nBackup concluído com sucesso.\n",
      "stderr": "",
      "started_at": "2026-07-02T00:23:57.040Z",
      "finished_at": "2026-07-02T00:23:59.185Z"
    }
    ```
  - `404 Not Found` (Execução não encontrada ou ID inválido).
  - `401 Unauthorized` (Chave inválida, expirada ou ausente).

---

### 3. Health Check (Rota Pública)
Valida a integridade da API.

- **URL:** `/health`
- **Método:** `GET`
- **Resposta:** `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```

---

## 📝 Registro de Logs (Pino Logger)

A API utiliza a biblioteca **Pino** para registrar de forma estruturada as informações de requisições HTTP, tempo de processamento e erros do sistema:

- **Logs Locais**: Todas as saídas de log são gravadas incrementalmente no arquivo `./logs/api.log` no formato JSON estruturado (a pasta é criada automaticamente se não existir).
- **Console (Stdout)**: Os mesmos logs são enviados simultaneamente para o console, facilitando a observação em tempo real.
- **Campos Disponíveis**:
  - `method` e `url` (método HTTP e rota).
  - `ip` (endereço IP de origem).
  - `status` (código HTTP de resposta).
  - `durationMs` (duração da execução em milissegundos).
  - `apiKeyPrefix` (prefixo da chave usada para facilitar auditoria sem expor o segredo).
  - `err` (objeto contendo detalhes e stacktrace de exceções capturadas nos blocos `catch`).

---

## 🧪 Desenvolvimento e Testes

Para garantir o funcionamento correto do código, estão disponíveis comandos de validação e testes automatizados:

```bash
# Iniciar servidor em modo desenvolvimento (Live reloading)
npm run dev

# Rodar a suíte de testes unitários e de integração (Jest)
npm test

# Executar a verificação estática do Linter (ESLint)
npm run lint

# Executar a checagem estática de tipos do TypeScript sem emitir arquivos
npm run build -- --noEmit

# Formatar o código seguindo padrões de estilo (Prettier)
npm run format
```
