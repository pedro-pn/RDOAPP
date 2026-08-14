/**
 * As pendências do formulário de login — **sem React**, para poder ser testada.
 *
 * Existe por causa da T098 do módulo Comercial: o login do filtroAPP tinha
 * **zero `aria-invalid`**. Entrar com campo vazio ia ao servidor e voltava com
 * "usuário ou senha inválidos" — uma mensagem que manda procurar erro de
 * digitação onde não há nada digitado, e que não diz **qual** dos dois campos
 * faltou. Para quem usa leitor de tela, não dizia nada.
 *
 * A correção é **na fonte**, não no módulo: este login é a porta de todos os
 * módulos, e contornar aqui deixaria a dívida para o próximo que reusasse.
 *
 * **Vazio é "obrigatório", nunca "inválido".** São dois estados diferentes, e
 * trocá-los faz a pessoa caçar um erro de digitação num campo que ela
 * simplesmente não preencheu — a mesma distinção que o módulo aplica em
 * `pendenciasDoCliente`.
 */
export type LoginFieldErrors = {
  username?: string;
  password?: string;
};

export function validateLoginFields(username: string, password: string): LoginFieldErrors {
  const pendencias: LoginFieldErrors = {};

  // `trim`: espaço não é preenchimento. Sem isso, uma barra de espaço passaria
  // a validação daqui e seria recusada pelo servidor com a mensagem genérica.
  if (!String(username || '').trim()) pendencias.username = 'Informe o usuário.';
  if (!String(password || '').trim()) pendencias.password = 'Informe a senha.';

  return pendencias;
}
