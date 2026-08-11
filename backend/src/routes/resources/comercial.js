import express, { Router } from 'express';
import { z } from 'zod';

import {
  ATTACHMENT_LIMITS,
  SCOPE_PHOTO_LIMITS,
  makeComercialSchemas
} from '../../../../shared/schemas/comercial.js';
import asyncHandler from '../../lib/async-handler.js';
import {
  canViewValues,
  serializeForUser,
  serializeListForUser
} from '../../lib/comercial/access.js';
import {
  ComercialError,
  CostEstimateValidationError,
  archiveCostEstimate,
  createCostEstimate,
  getCostEstimate,
  listCostEstimates,
  updateCostEstimate
} from '../../lib/comercial/cost-estimates.js';
import { listarConsultores } from '../../lib/comercial/consultores.js';
import { baixarDocumento, emitirDocumentos } from '../../lib/comercial/documentos.js';
import { anexarArquivo, listarAnexos } from '../../lib/comercial/anexos.js';
import { finalizarProposta } from '../../lib/comercial/jobs.js';
import { indisponivel, listarFunis } from '../../lib/comercial/nectar.js';
import { attachmentContentDisposition } from '../../lib/documents/storage.js';
import {
  archiveProposal,
  createProposal,
  getProposal,
  listProposals,
  updateProposal
} from '../../lib/comercial/proposals.js';
import { gravarFoto, lerFoto } from '../../lib/comercial/scope-assets.js';
import { nextProposalNumber, numberingStatus } from '../../lib/comercial/numbering.js';
import { gerarPropostaEmPdf } from '../../lib/comercial/proposta-docx.js';
import { comercialStatus } from '../../lib/comercial/service.js';
import prisma from '../../lib/prisma.js';
import {
  requireAuth,
  requireComercialAccess,
  requireComercialEstimator
} from '../../middleware/auth.js';

const router = Router();
const schemas = makeComercialSchemas(z);

router.use(requireAuth);
router.use(requireComercialAccess);

/**
 * Rotas do módulo Comercial.
 *
 * Duas regras que valem para o arquivo inteiro:
 *
 * 1. `requireComercialEstimator` barra o papel de consulta, mas **não sabe de
 *    quem é o registro**. A autoria é verificada na camada de negócio, e a
 *    listagem filtra por autoria lá também — é onde o vazamento entre
 *    vendedores aconteceria.
 *
 * 2. **Não existe `DELETE`.** O módulo arquiva (FR-060).
 */

function handleComercialError(error, res) {
  if (error instanceof CostEstimateValidationError) {
    // Pendências item a item, com o endereço do campo — é o que permite à tela
    // destacar cada campo em vez de despejar tudo num banner único (L1).
    res.status(error.statusCode).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof ComercialError) {
    res.status(error.statusCode || 400).json({ error: error.message });
    return true;
  }
  return false;
}

/**
 * Lê a foto de um bloco de escopo para o gerador do documento.
 *
 * As fotos **não viajam no corpo**: só o `id` vem, e o servidor lê os bytes do
 * disco. Mandá-las de volta a cada prévia trafegaria megabytes por clique, e o
 * arquivo já está aqui. Está numa função só porque prévia, emissão e
 * finalização precisam exatamente da mesma leitura.
 */
async function fotoDoBloco(bloco) {
  const { bytes, contentType, fileName } = await lerFoto(prisma, bloco.assetKey || bloco.id);
  const extensao = (fileName.split('.').pop() || 'jpg').toLowerCase();
  return { bytes, extensao, mime: contentType };
}

router.get('/status', (_req, res) => {
  res.json(comercialStatus());
});

// ---------------------------------------------------------------------------
// Fotos dos blocos de conteúdo do escopo
// ---------------------------------------------------------------------------

/**
 * Recebe a foto como **binário cru**, no padrão que este repositório já usa para
 * upload (`acompanhamento-comercial.js`): o `Content-Type` é o tipo da imagem e o
 * nome original vem em `x-file-name`. Evita uma dependência de multipart para
 * receber um arquivo por requisição — o cliente já envia um de cada vez.
 *
 * A cadeia de recusa mora em `scope-assets.js`, com mensagem própria por caso.
 * `express.raw` corta acima do limite de requisição antes de o corpo chegar aqui.
 */
router.post(
  '/escopo/fotos',
  requireComercialEstimator,
  express.raw({
    type: SCOPE_PHOTO_LIMITS.allowedTypes,
    limit: SCOPE_PHOTO_LIMITS.maxRequestBytes
  }),
  asyncHandler(async (req, res) => {
    try {
      // Tipo fora da lista não casa com `express.raw`, e o corpo chega vazio.
      // A distinção importa: "selecione uma foto" e "use JPEG, PNG ou WebP" são
      // problemas diferentes e mandam o usuário para lados diferentes.
      const tipoDeclarado = String(req.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase();

      if (tipoDeclarado && !SCOPE_PHOTO_LIMITS.allowedTypes.includes(tipoDeclarado)) {
        return res.status(415).json({ error: 'Use uma imagem JPEG, PNG ou WebP.' });
      }

      const foto = await gravarFoto(prisma, {
        bytes: Buffer.isBuffer(req.body) ? req.body : null,
        contentType: tipoDeclarado,
        fileName: req.headers['x-file-name'],
        userId: req.auth.user.id
      });

      return res.status(201).json(foto);
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/escopo/fotos/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const { bytes, contentType, fileName } = await lerFoto(prisma, req.params.id);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      // Imutável: o arquivo tem nome de UUID e nunca é reescrito.
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      return res.send(bytes);
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

// ---------------------------------------------------------------------------
// Consultores de vendas
// ---------------------------------------------------------------------------

/**
 * A lista **varia por papel**: gestor recebe todos, vendedor recebe só a si mesmo.
 * A restrição acontece aqui, na origem — não é o cliente que filtra.
 */
router.get(
  '/consultores',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    res.json(await listarConsultores(prisma, req.auth.user));
  })
);

// ---------------------------------------------------------------------------
// Numeração
// ---------------------------------------------------------------------------

/**
 * O próximo número de proposta. **Consome** — dois pedidos devolvem números
 * diferentes, e um número consumido não volta.
 *
 * `503` enquanto a numeração não tiver sido semeada no ambiente. É recusa
 * deliberada: emitir sem saber o maior número já usado produziria código repetido
 * no documento que chega ao cliente.
 */
router.get(
  '/propostas/proximo-numero',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const numero = await nextProposalNumber(prisma);
      res.json({ numero });
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/numeracao/status',
  requireComercialEstimator,
  asyncHandler(async (_req, res) => {
    res.json(await numberingStatus(prisma));
  })
);

// ---------------------------------------------------------------------------
// Levantamentos de custos
// ---------------------------------------------------------------------------

router.get(
  '/levantamentos',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    const query = schemas.listQuery.parse(req.query);
    const { items, total } = await listCostEstimates(prisma, req.auth.user, query);
    res.json({ items: serializeListForUser(req.auth.user, items), total });
  })
);

router.post(
  '/levantamentos',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const data = schemas.costEstimateCreate.parse(req.body);
      const estimate = await createCostEstimate(prisma, req.auth.user, data);
      res.status(201).json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/levantamentos/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const estimate = await getCostEstimate(prisma, req.auth.user, req.params.id);
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.put(
  '/levantamentos/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const data = schemas.costEstimateUpdate.parse(req.body);
      const estimate = await updateCostEstimate(prisma, req.auth.user, req.params.id, data);
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/levantamentos/:id/arquivar',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const estimate = await archiveCostEstimate(prisma, req.auth.user, req.params.id, {
        archive: true
      });
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/levantamentos/:id/desarquivar',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const estimate = await archiveCostEstimate(prisma, req.auth.user, req.params.id, {
        archive: false
      });
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

/**
 * Prévia do documento em PDF — o gerador da T072 exposto para conferência.
 *
 * **Não é a finalização.** Aqui o PDF é gerado e devolvido na hora, sem gravar
 * nada, sem numerar proposta e sem tocar em integração — é o que permite
 * conferir o documento antes de existir proposta salva. A emissão oficial é a
 * T075, que grava os dois arquivos ANTES de qualquer tentativa de integração.
 *
 * Por isso o corpo vem do formulário e não do banco: nesta etapa a proposta
 * ainda não foi salva.
 */
router.post(
  '/propostas/previa.pdf',
  requireComercialEstimator,
  express.json({ limit: '2mb' }),
  asyncHandler(async (req, res) => {
    const corpo = req.body || {};
    const tecnico = corpo.tipo === 'technical';

    // O papel `viewer` não chega aqui — `requireComercialEstimator` já barra —,
    // mas o comercial carrega valores e a regra de FR-030a vale desde já: quem
    // não pode ver valor não pode baixar o documento que os contém.
    if (!tecnico && !canViewValues(req.auth.user)) {
      return res.status(403).json({ error: 'Sem permissão para o documento comercial.' });
    }

    // O documento sai do modelo `.docx` de `Modelos/definitivos/Comercial/modelos/`,
    // convertido pelo mesmo LibreOffice dos relatórios. Trocar um parágrafo é
    // editar o `.docx` — sem programador e sem deploy.
    //
    // As fotos do escopo não viajam no corpo da requisição: só o `id` vem, e o
    // servidor lê os bytes do disco. Mandar a foto de volta ao servidor a cada
    // prévia trafegaria megabytes por clique, e o arquivo já está aqui.
    const bytes = await gerarPropostaEmPdf(
      { ...corpo, lerFoto: fotoDoBloco },
      tecnico ? 'technical' : 'commercial'
    );

    const codigo = String(corpo.proposalCode || 'sem-numero');
    const nome = `Proposta ${tecnico ? 'Técnica' : 'Comercial'} - ${codigo}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nome)}"`);
    // Prévia não se guarda: o documento muda a cada tecla do formulário.
    res.setHeader('Cache-Control', 'no-store');
    return res.send(bytes);
  })
);

// ---------------------------------------------------------------------------
// Propostas
// ---------------------------------------------------------------------------

/**
 * **A ordem de registro importa aqui.** `/propostas/proximo-numero` e
 * `/propostas/previa.pdf` estão declaradas acima, e por isso vencem o
 * `/propostas/:id` que vem a seguir — o Express casa na ordem em que as rotas
 * foram registradas. Mover o `:id` para cima transformaria "proximo-numero" num
 * id de proposta, e o sintoma seria um 404 em vez de um número.
 */

/**
 * A listagem é a **única superfície** do papel de consulta (FR-030), e por isso
 * é a única rota de proposta que não exige orçamentista. Duas coisas acontecem
 * na origem, não na tela:
 *
 * - o alcance (`proposalScopeFilter`): vendedor vê só as suas;
 * - a supressão de valores (`serializeListForUser`): consulta não recebe
 *   `totalValue` no JSON — não é campo escondido, é campo ausente.
 */
router.get(
  '/propostas',
  asyncHandler(async (req, res) => {
    try {
      const query = schemas.proposalListQuery.parse(req.query);
      const { items, total } = await listProposals(prisma, req.auth.user, query);
      res.json({ items: serializeListForUser(req.auth.user, items), total });
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/propostas',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const data = schemas.proposalCreate.parse(req.body);
      const proposal = await createProposal(prisma, req.auth.user, data);
      res.status(201).json(serializeForUser(req.auth.user, proposal));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

/**
 * Emissão dos dois documentos (T075). **Não é a finalização** — nenhuma
 * integração é acionada aqui.
 *
 * O que esta rota garante é a **ordem**: os PDFs saem do `.docx`, vão para o
 * disco sob `COMERCIAL_DIR` e só então viram registro. É o que permite, na
 * T076, responder erro de integração dizendo que os documentos continuam
 * baixáveis (FR-034).
 *
 * Diferente da prévia, o conteúdo vem do **registro**, não do corpo: o que se
 * emite é o que está salvo. As fotos do escopo continuam sendo lidas do disco
 * pelo `id`, sem trafegar de volta.
 */
router.post(
  '/propostas/documentos',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const { proposalId } = schemas.proposalDocumentsRequest.parse(req.body);

      const resultado = await emitirDocumentos(prisma, req.auth.user, proposalId, {
        gerarPdf: (dados, tipo) => gerarPropostaEmPdf({ ...dados, lerFoto: fotoDoBloco }, tipo)
      });

      res.status(201).json(resultado);
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

/**
 * Os funis que este ambiente pode usar.
 *
 * A lista já vem **filtrada pela lista branca** — funil que existe no Nectar mas
 * não está autorizado aqui não chega à tela, então ninguém o escolhe por engano.
 * `motivoIndisponivel` diz por que a lista veio vazia: sem ele, o ambiente com o
 * envio desligado mostraria um seletor vazio sem explicação.
 */
router.get(
  '/nectar/funis',
  requireComercialEstimator,
  asyncHandler(async (_req, res) => {
    const motivo = indisponivel();
    if (motivo) return res.json({ items: [], motivoIndisponivel: motivo });

    try {
      res.json({ items: await listarFunis(), motivoIndisponivel: '' });
    } catch (error) {
      // Nectar fora do ar não derruba a tela: ela precisa continuar mostrando a
      // proposta, e a emissão dos documentos não depende do CRM.
      res.json({ items: [], motivoIndisponivel: error.message });
    }
  })
);

/**
 * Finalização (T076/T077).
 *
 * **O contrato de falha é o ponto desta rota.** Quando a integração falha
 * depois de os documentos estarem gravados, a resposta é **erro** — mas leva os
 * documentos junto, porque eles existem e continuam baixáveis (FR-034). Um erro
 * seco faria o usuário refazer trabalho que já está pronto no servidor.
 */
router.post(
  '/propostas/finalizar',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const { proposalId, pipelineId, pastaExistente } =
        schemas.proposalFinalizeRequest.parse(req.body);

      const resultado = await finalizarProposta(prisma, req.auth.user, proposalId, {
        pipelineId,
        pastaExistente,
        gerarPdf: (dados, tipo) => gerarPropostaEmPdf({ ...dados, lerFoto: fotoDoBloco }, tipo)
      });

      if (resultado.ok) return res.json(resultado);

      return res.status(502).json({
        error: resultado.integracao.mensagem,
        documentosDisponiveis: true,
        documentos: resultado.documentos,
        integracao: resultado.integracao,
        sharepoint: resultado.sharepoint
      });
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

/**
 * Anexos do cliente (T076d) — `PROP-CTL-081`.
 *
 * **Um arquivo por requisição**, ao contrário da referência, que mandava tudo
 * junto no `finalize`. Separar evita estourar o limite de corpo em proposta com
 * muitos anexos, e dá a recusa **no arquivo que a causou**.
 *
 * Binário cru, no mesmo padrão das fotos de escopo: o nome vem em `x-file-name`.
 * O limite agregado é conferido aqui **e** de novo na finalização — aqui por
 * gentileza, lá porque é o contrato (FR-059).
 */
router.post(
  '/propostas/:id/anexos',
  requireComercialEstimator,
  express.raw({ type: () => true, limit: ATTACHMENT_LIMITS.maxRequestBytes }),
  asyncHandler(async (req, res) => {
    try {
      const anexo = await anexarArquivo(prisma, req.auth.user, req.params.id, {
        bytes: Buffer.isBuffer(req.body) ? req.body : null,
        fileName: decodeURIComponent(String(req.headers['x-file-name'] || ''))
      });

      res.status(201).json({
        id: anexo.id,
        originalName: anexo.originalName,
        byteSize: anexo.byteSize,
        createdAt: anexo.createdAt
      });
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

/** A listagem diz também quanto do limite agregado já foi usado. */
router.get(
  '/propostas/:id/anexos',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      res.json(await listarAnexos(prisma, req.auth.user, req.params.id));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/propostas/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const proposal = await getProposal(prisma, req.auth.user, req.params.id);
      res.json(serializeForUser(req.auth.user, proposal));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.put(
  '/propostas/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const data = schemas.proposalUpdate.parse(req.body);
      const proposal = await updateProposal(prisma, req.auth.user, req.params.id, data);
      res.json(serializeForUser(req.auth.user, proposal));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/propostas/:id/arquivar',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const proposal = await archiveProposal(prisma, req.auth.user, req.params.id, {
        archive: true
      });
      res.json(serializeForUser(req.auth.user, proposal));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/propostas/:id/desarquivar',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const proposal = await archiveProposal(prisma, req.auth.user, req.params.id, {
        archive: false
      });
      res.json(serializeForUser(req.auth.user, proposal));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

// ---------------------------------------------------------------------------
// Documentos emitidos
// ---------------------------------------------------------------------------

/**
 * Download de um documento emitido (T079).
 *
 * `requireComercialAccess`, e não `requireComercialEstimator`: o papel de
 * consulta baixa a proposta **técnica**. O que ele não alcança é a comercial —
 * e a negativa é **desta rota**, com 403. Esconder o botão na tela deixaria o
 * arquivo servível para quem montasse a URL na mão, e a restrição de valores
 * deixaria de valer para qualquer um com o link.
 */
router.get(
  '/documentos/:id',
  asyncHandler(async (req, res) => {
    try {
      const { bytes, fileName } = await baixarDocumento(prisma, req.auth.user, req.params.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', attachmentContentDisposition(fileName));
      // Documento com valor de proposta não fica em cache compartilhado.
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(bytes);
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

export default router;
