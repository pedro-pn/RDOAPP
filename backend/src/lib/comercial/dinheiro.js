/**
 * Leitura da máscara de moeda — **uma definição só**, para o documento e para o
 * banco.
 *
 * Isto morava dentro de `proposta-docx.js`, privado. Saiu porque `proposals.js`
 * precisa somar exatamente os mesmos números para gravar o `totalValue`: duas
 * implementações da mesma conta divergem em silêncio, e a divergência aqui
 * aparece como um valor no histórico diferente do TOTAL GERAL impresso no PDF
 * que o cliente já recebeu. É a mesma armadilha da fórmula do Word em cache.
 */

/**
 * Desfaz a máscara de moeda do formulário.
 *
 * Ponto é milhar e vírgula é decimal, ao contrário do que `Number` espera. Ler
 * "R$ 11.250,00" com `Number` daria `NaN`, e o total sairia "R$ NaN" impresso.
 */
export function lerDinheiro(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const limpo = String(valor ?? '').replace(/[^\d,.-]/g, '');
  const numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : 0;
}

export function moeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0
  );
}
