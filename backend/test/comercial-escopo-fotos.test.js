import assert from 'node:assert/strict';
import test from 'node:test';

import { SCOPE_PHOTO_LIMITS } from '../../shared/schemas/comercial.js';
import { sanearNome, validarFoto } from '../src/lib/comercial/scope-assets.js';

/**
 * Cadeia de recusa do upload de foto do escopo (tarefa T074c).
 *
 * **O caso que este arquivo existe para provar é o último**: um arquivo qualquer
 * renomeado para `.jpg`. Ele chega com `Content-Type: image/jpeg`, porque quem
 * renomeia também controla o cabeçalho — confiar no tipo declarado é confiar em quem
 * envia.
 *
 * Os demais casos importam pela **mensagem**, não só pelo status: "arquivo inválido"
 * não diz a ninguém o que fazer a seguir.
 */

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function bytes(prefixo, tamanho = 64) {
  const buffer = Buffer.alloc(tamanho);
  Buffer.from(prefixo).copy(buffer);
  return buffer;
}

test('JPEG, PNG e WebP legítimos passam', () => {
  assert.deepEqual(validarFoto({ bytes: bytes(JPEG), contentType: 'image/jpeg' }), {
    contentType: 'image/jpeg',
    extensao: 'jpg'
  });
  assert.equal(validarFoto({ bytes: bytes(PNG), contentType: 'image/png' }).extensao, 'png');
  assert.equal(
    validarFoto({ bytes: bytes(WEBP), contentType: 'image/webp' }).extensao,
    'webp'
  );
});

test('O CASO CRÍTICO: arquivo renomeado para .jpg é recusado', () => {
  // Um executável, um PDF, um zip — qualquer coisa. O cliente diz image/jpeg e o
  // conteúdo diz outra coisa. Sem a checagem de assinatura, isto entra no disco
  // do servidor e depois no PDF que vai ao cliente.
  const naoEImagem = Buffer.from('MZ\\x90\\x00 isto é um executável, não uma foto');

  assert.throws(
    () => validarFoto({ bytes: naoEImagem, contentType: 'image/jpeg' }),
    error => {
      assert.equal(error.statusCode, 415);
      assert.match(error.message, /não corresponde a uma imagem válida/);
      return true;
    }
  );
});

test('RIFF que não é WebP também é recusado', () => {
  // "RIFF" sozinho é contêiner de áudio e vídeo. Checar só os 4 primeiros bytes
  // deixaria um .wav entrar declarado como image/webp.
  const riffDeAudio = bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

  assert.throws(
    () => validarFoto({ bytes: riffDeAudio, contentType: 'image/webp' }),
    error => {
      assert.equal(error.statusCode, 415);
      return true;
    }
  );
});

test('assinatura trocada entre tipos não passa', () => {
  // PNG declarado como JPEG: os dois são imagens de verdade, mas o tipo mente, e
  // o gerador de PDF decodifica pelo tipo declarado.
  assert.throws(() => validarFoto({ bytes: bytes(PNG), contentType: 'image/jpeg' }));
  assert.throws(() => validarFoto({ bytes: bytes(JPEG), contentType: 'image/png' }));
});

test('corpo vazio pede a foto, não acusa formato', () => {
  // São problemas diferentes e mandam o usuário para lados diferentes.
  for (const vazio of [null, undefined, Buffer.alloc(0)]) {
    assert.throws(
      () => validarFoto({ bytes: vazio, contentType: 'image/jpeg' }),
      error => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /Selecione uma foto/);
        return true;
      }
    );
  }
});

test('tipo fora da lista é 415 com a lista na mensagem', () => {
  for (const tipo of ['image/gif', 'application/pdf', 'image/svg+xml', '']) {
    assert.throws(
      () => validarFoto({ bytes: bytes(JPEG), contentType: tipo }),
      error => {
        assert.equal(error.statusCode, 415);
        assert.match(error.message, /JPEG, PNG ou WebP/);
        return true;
      }
    );
  }
});

test('SVG é recusado, e isso é deliberado', () => {
  // SVG é documento executável: carrega script e referência externa. Numa lista de
  // "imagens" ele parece pertencer e não pertence.
  assert.throws(() => validarFoto({ bytes: bytes(JPEG), contentType: 'image/svg+xml' }));
});

test('acima de 1,5 MB é 413, mesmo com assinatura boa', () => {
  // O cliente deveria ter otimizado. O servidor não confia nisso: a otimização
  // existe para caber, a validação existe porque pode ser contornada.
  const grande = bytes(JPEG, SCOPE_PHOTO_LIMITS.maxBytes + 1);

  assert.throws(
    () => validarFoto({ bytes: grande, contentType: 'image/jpeg' }),
    error => {
      assert.equal(error.statusCode, 413);
      assert.match(error.message, /1,5 MB/);
      return true;
    }
  );
});

test('a ordem da cadeia é vazio → tipo → tamanho → assinatura', () => {
  // Um arquivo grande E sem assinatura acusa o tamanho primeiro: é o que o
  // usuário consegue resolver. Mandá-lo caçar corrupção num arquivo que só
  // precisava encolher seria desperdiçar o tempo dele.
  const grandeESemAssinatura = Buffer.alloc(SCOPE_PHOTO_LIMITS.maxBytes + 1);

  assert.throws(
    () => validarFoto({ bytes: grandeESemAssinatura, contentType: 'image/jpeg' }),
    error => {
      assert.equal(error.statusCode, 413);
      return true;
    }
  );
});

test('o nome original é saneado, e caminho não escapa da pasta', () => {
  // O arquivo em disco tem nome de UUID, então o nome é só exibição. Ainda assim:
  // nome vindo do cliente que chega até um caminho é a forma clássica de sair da
  // pasta.
  assert.equal(sanearNome('../../etc/passwd'), 'passwd');
  // Caminho do Windows num servidor POSIX: `basename` não corta na barra
  // invertida, então ela vira `_` junto com os dois-pontos. O que importa é que
  // nada aqui volta a ser separador de caminho.
  assert.equal(sanearNome('C:\\Windows\\system32\\cmd.exe'), 'C_Windows_system32_cmd.exe');
  assert.equal(sanearNome('foto da obra.jpg'), 'foto da obra.jpg');
  assert.equal(sanearNome(''), 'foto');
  assert.equal(sanearNome(null), 'foto');
  assert.ok(sanearNome('a'.repeat(500)).length <= 180);
});
