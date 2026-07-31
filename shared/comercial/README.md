# `shared/comercial`

Regra de negócio do módulo Comercial, **portada sem alteração** de
`~/comercialAPP`, congelado no commit `6f5b072`.

## Os arquivos de `src/` não devem ser editados

`cost-model.ts`, `technical-services.ts`, `scope-content.ts`,
`proposal-visuals.ts`, `finalization.ts` e `nectar-pipelines.ts` são **cópia byte
a byte** da referência. São eles que os 16 goldens de
`specs/009-modulo-comercial/contracts/goldens/` verificam.

Só dois arquivos foram escritos aqui:

- `src/index.ts` — barril, só reexporta
- `src/ambient.d.ts` — declaração mínima de `process`, para compilar sem
  instalar `@types/node` num pacote que é regra de negócio pura

## Verificar a integridade da cópia

```bash
for f in cost-model finalization nectar-pipelines; do
  cmp ~/comercialAPP/lib/$f.ts shared/comercial/src/$f.ts
done
for f in technical-services scope-content proposal-visuals; do
  cmp ~/comercialAPP/app/$f.ts shared/comercial/src/$f.ts
done
```

## Build

```bash
cd shared/comercial && ../../frontend/node_modules/.bin/tsc -p tsconfig.json
```

Gera `dist/` com `.js` + `.d.ts`, consumido pelo backend e pelo frontend.

## Se um golden falhar

**O defeito é do porte.** Nunca regere um golden para fazer o teste passar —
isso destrói exatamente a prova que estes arquivos existem para dar. O efeito
prático de um golden errado é uma proposta com preço errado, e ninguém percebe:
o número sai, só sai errado.

Regerar só se justifica quando a referência congelada muda, e nesse caso o
commit gravado em `manifest.json` deixa de bater com o `HEAD` de
`~/comercialAPP`.
