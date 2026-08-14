/**
 * O marcador de "já viu o tutorial" do módulo — FR-025a, T096.
 *
 * **Por usuário e no servidor**, e é essa a decisão inteira. Em `localStorage`,
 * dois usuários da mesma máquina compartilhariam o marcador — o segundo nunca
 * veria o tutorial — e o mesmo usuário o veria de novo em outro computador. O
 * tutorial acompanha a **pessoa**; a campanha de novidade de 10 dias é que
 * acompanha o dispositivo (FR-025b), e continua no navegador.
 *
 * O marcador responde uma pergunta só: **"o tutorial já apareceu sozinho para
 * esta conta?"**. Rever pelo botão não mexe aqui, senão o botão de rever
 * transformaria uma consulta voluntária em "nunca mais viu", que é o oposto do
 * que ele significa.
 */

/** Já viu? Erro de leitura responde **que sim**. */
export async function jaViuTutorial(prisma, userId) {
  const id = String(userId || '').trim();
  if (!id) return true;

  try {
    return Boolean(await prisma.comercialTutorialSeen.findUnique({ where: { userId: id } }));
  } catch {
    // Falhar aqui abriria o tutorial por cima de quem já o dispensou, toda vez
    // que o banco piscasse. Entre repetir e não aparecer, não aparecer é o erro
    // menos intrusivo — e o botão de rever continua ali.
    return true;
  }
}

/**
 * Marca como visto. **Idempotente**: dispensar duas vezes não é erro, e é o que
 * acontece quando o usuário fecha o tutorial em duas abas abertas juntas.
 */
export async function marcarTutorialVisto(prisma, userId) {
  const id = String(userId || '').trim();
  if (!id) return { visto: true };

  await prisma.comercialTutorialSeen.upsert({
    where: { userId: id },
    update: {},
    create: { userId: id }
  });

  return { visto: true };
}
