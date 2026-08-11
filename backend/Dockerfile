FROM node:22-bookworm-slim

# As fontes NAO sao opcionais: os modelos .docx pedem Arial (e os relatorios
# antigos, Calibri e Cambria pelo tema). Sem elas o LibreOffice substitui pelo
# que houver -- e so havia DejaVu, que NAO e metricamente compativel com Arial.
# O efeito nao e so "outra cara": a largura de cada caractere muda, entao a linha
# quebra em outro lugar e a tabela fecha noutra medida. O PDF sai diferente do
# que quem escreveu o documento viu no Word.
#
# Liberation Sans/Serif/Mono sao metricamente compativeis com Arial, Times New
# Roman e Courier New; Carlito com Calibri; Caladea com Cambria. O LibreOffice
# ja traz a tabela de substituicao para todas elas.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation fonts-crosextra-carlito fonts-crosextra-caladea \
    fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma.config.ts ./prisma.config.ts
COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/data ./data
COPY backend/assets ./assets
COPY shared /workspace/shared
RUN mkdir -p /data/assets && cp -R ./assets/. /data/assets/
COPY Modelos /workspace/Modelos
COPY equipamentos /workspace/equipamentos

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
