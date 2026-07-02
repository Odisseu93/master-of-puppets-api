import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import crypto from 'crypto';
import { getDatabase } from '../database';

/**
 * Formats a date string or returns "Indefinite" if null.
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Indefinite';
  return new Date(dateStr).toLocaleString('pt-BR');
}

/**
 * Computes SHA-256 hash of a string.
 */
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Main key management CLI.
 */
async function main() {
  const rl = readline.createInterface({ input, output });
  const db = await getDatabase();

  console.log('\n=============================================');
  console.log('  Master of Puppets API - Key Manager CLI  ');
  console.log('=============================================\n');

  let running = true;

  while (running) {
    console.log('1. Gerar Nova API Key');
    console.log('2. Revogar API Key');
    console.log('3. Listar API Keys');
    console.log('4. Sair');
    
    const choice = await rl.question('\nEscolha uma opção (1-4): ');

    switch (choice.trim()) {
      case '1': {
        const name = await rl.question('Digite o nome/descrição da chave: ');
        if (!name.trim()) {
          console.log('\x1b[31mErro: O nome da chave não pode ser vazio.\x1b[0m\n');
          break;
        }

        const daysInput = await rl.question('Expiração em dias (deixe vazio para indeterminado): ');
        let expiresAt: string | null = null;
        if (daysInput.trim()) {
          const days = parseInt(daysInput.trim(), 10);
          if (isNaN(days) || days <= 0) {
            console.log('\x1b[31mErro: Número de dias inválido.\x1b[0m\n');
            break;
          }
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + days);
          expiresAt = expirationDate.toISOString();
        }

        // Generate key
        const prefix = `sk_live_${crypto.randomBytes(4).toString('hex')}`;
        const secret = crypto.randomBytes(24).toString('hex');
        const fullKey = `${prefix}.${secret}`;
        const keyHash = hashKey(fullKey);

        try {
          await db.run(
            `INSERT INTO api_keys (name, key_hash, key_prefix, expires_at)
             VALUES (?, ?, ?, ?)`,
            [name.trim(), keyHash, prefix, expiresAt]
          );

          console.log('\n\x1b[32m✔ API Key gerada com sucesso!\x1b[0m');
          console.log('--------------------------------------------------');
          console.log(`Nome:      ${name}`);
          console.log(`Prefixo:   ${prefix}`);
          console.log(`Expiração: ${formatDate(expiresAt)}`);
          console.log('--------------------------------------------------');
          console.log('\x1b[33mATENÇÃO: Copie a chave abaixo. Ela não será exibida novamente!\x1b[0m');
          console.log(`Chave:     \x1b[1m${fullKey}\x1b[22m`);
          console.log('--------------------------------------------------\n');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('\x1b[31mErro ao salvar API Key:\x1b[0m', errorMsg);
        }
        break;
      }

      case '2': {
        // List active keys first
        const keys = await db.all<Array<{ id: number; name: string; key_prefix: string; expires_at: string | null }>>(
          `SELECT id, name, key_prefix, expires_at FROM api_keys 
           WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
          [new Date().toISOString()]
        );

        if (keys.length === 0) {
          console.log('\x1b[33mNenhuma API Key ativa encontrada para revogação.\x1b[0m\n');
          break;
        }

        console.log('\n--- Chaves Ativas ---');
        keys.forEach(k => {
          console.log(`ID: ${k.id} | Nome: ${k.name} | Prefixo: ${k.key_prefix} (Expira em: ${formatDate(k.expires_at)})`);
        });

        const idInput = await rl.question('\nDigite o ID da chave que deseja REVOGAR (ou pressione ENTER para cancelar): ');
        if (!idInput.trim()) {
          console.log('Operação cancelada.\n');
          break;
        }

        const id = parseInt(idInput.trim(), 10);
        if (isNaN(id)) {
          console.log('\x1b[31mErro: ID inválido.\x1b[0m\n');
          break;
        }

        const result = await db.run(
          `UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
          [new Date().toISOString(), id]
        );

        if (result.changes && result.changes > 0) {
          console.log(`\n\x1b[32m✔ API Key ID ${id} revogada com sucesso!\x1b[0m\n`);
        } else {
          console.log(`\n\x1b[31mErro: Nenhuma chave ativa encontrada com o ID ${id}.\x1b[0m\n`);
        }
        break;
      }

      case '3': {
        const keys = await db.all<Array<{ id: number; name: string; key_prefix: string; created_at: string; expires_at: string | null; revoked_at: string | null }>>(
          `SELECT id, name, key_prefix, created_at, expires_at, revoked_at FROM api_keys ORDER BY id DESC`
        );

        if (keys.length === 0) {
          console.log('\x1b[33mNenhuma API Key registrada no banco.\x1b[0m\n');
          break;
        }

        console.log('\n-------------------------------- Chaves de API Registradas --------------------------------');
        console.table(
          keys.map(k => {
            const now = new Date();
            let status = '\x1b[32mAtiva\x1b[0m';
            if (k.revoked_at) {
              status = `\x1b[31mRevogada\x1b[0m (${new Date(k.revoked_at).toLocaleDateString('pt-BR')})`;
            } else if (k.expires_at && new Date(k.expires_at) < now) {
              status = `\x1b[31mExpirada\x1b[0m (${new Date(k.expires_at).toLocaleDateString('pt-BR')})`;
            }

            return {
              ID: k.id,
              Nome: k.name,
              Prefixo: k.key_prefix,
              Criado_Em: new Date(k.created_at).toLocaleDateString('pt-BR'),
              Expira_Em: formatDate(k.expires_at),
              Status: status
            };
          })
        );
        console.log('--------------------------------------------------------------------------------------------\n');
        break;
      }

      case '4': {
        running = false;
        break;
      }

      default: {
        console.log('\x1b[31mOpção inválida. Escolha entre 1 e 4.\x1b[0m\n');
        break;
      }
    }
  }

  rl.close();
  await db.close();
  console.log('Até logo!');
}

main().catch(err => {
  console.error('Erro na CLI:', err);
  process.exit(1);
});
