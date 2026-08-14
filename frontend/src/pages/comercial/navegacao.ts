/** Faz a próxima etapa começar no topo visível do formulário. */
export function rolarParaInicioDoFormulario(
  elemento: Pick<Element, 'scrollIntoView'> | null
) {
  elemento?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Monta o endereço depois de salvar e avançar no levantamento.
 *
 * No primeiro avanço, o `id` acabou de nascer no POST e ainda não existe nos
 * parâmetros capturados pelo render atual. Montar os dois valores junto evita
 * que a troca de seção apague esse id por usar uma fotografia antiga da URL.
 */
export function parametrosDoLevantamentoAposAvanco(
  atuais: URLSearchParams,
  secao: string,
  levantamentoId = ''
): URLSearchParams {
  const proximos = new URLSearchParams(atuais);
  proximos.set('secao', secao);
  if (levantamentoId) proximos.set('id', levantamentoId);
  return proximos;
}
