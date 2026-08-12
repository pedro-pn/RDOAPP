// Barril do módulo Comercial.
//
// Os seis primeiros arquivos abaixo são cópia byte a byte da referência
// congelada (~/comercialAPP, commit 6f5b072) e NÃO devem ser editados: são eles
// que os 16 goldens de specs/009-modulo-comercial/contracts/goldens/ verificam.
// Divergência de golden é defeito do porte, nunca motivo para regerar.
//
// `modelo-documento.ts` é a exceção, e por isso vem separado: ele é **escrito**,
// e a fonte dele são os `.docx` de Modelos/definitivos/Comercial (desvio 12),
// não a referência. Nenhum golden o cobre.
//
// Este índice só reexporta.

export * from "./cost-model";
export * from "./technical-services";
export * from "./scope-content";
export * from "./proposal-visuals";
export * from "./finalization";
export * from "./nectar-pipelines";
// Leitura da máscara de moeda: servidor, gerador do documento e tela usam esta.
export * from "./dinheiro";

export * from "./modelo-documento";
