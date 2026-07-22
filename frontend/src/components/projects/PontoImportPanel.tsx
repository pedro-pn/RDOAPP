import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deletePontoImport,
  getPontoColaboradores,
  getPontoImports,
  getPontoLinkCollaborators,
  importPonto,
  linkPontoName
} from '../../api/acompanhamentoPonto';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import { acompanhamentoRefreshQueryOptions } from './acompanhamentoRefresh';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function collaboratorOptionLabel(collaborator: { name: string; role: string | null; isActive?: boolean }) {
  const label = `${collaborator.name}${collaborator.role ? ` — ${collaborator.role}` : ''}`;
  return collaborator.isActive === false ? `${label} (inativo)` : label;
}

export function PontoImportPanel() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const isManager = user?.accountType === 'ADMIN' || Boolean(user?.moduleRoles?.includes('acompanhamento:manager'));

  const { data: imports } = useQuery({
    queryKey: ['ponto-imports'],
    queryFn: getPontoImports,
    ...acompanhamentoRefreshQueryOptions
  });
  const { data: colaboradores } = useQuery({
    queryKey: ['ponto-colaboradores'],
    queryFn: getPontoColaboradores,
    ...acompanhamentoRefreshQueryOptions
  });
  const { data: linkCollaborators } = useQuery({
    queryKey: ['ponto-collaborators-link'],
    queryFn: getPontoLinkCollaborators,
    enabled: isManager
  });

  const [links, setLinks] = useState<Record<string, string>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ponto-imports'] });
    queryClient.invalidateQueries({ queryKey: ['ponto-colaboradores'] });
    queryClient.invalidateQueries({ queryKey: ['project-cards'] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => importPonto(file),
    onSuccess: result => {
      if (result.skippedDuplicate) showToast('Este arquivo já havia sido importado.');
      else showToast(`Ponto importado: ${result.collaboratorsMatched}/${result.collaboratorsTotal} colaboradores vinculados.`);
      invalidate();
    },
    onError: () => showToast('Não foi possível importar o ponto.')
  });

  const linkMutation = useMutation({
    mutationFn: (payload: { normalizedName: string; collaboratorId: string }) => linkPontoName(payload),
    onSuccess: () => { showToast('Nome vinculado.'); invalidate(); },
    onError: () => showToast('Não foi possível vincular o nome.')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePontoImport(id),
    onSuccess: () => { showToast('Importação excluída.'); invalidate(); },
    onError: () => showToast('Não foi possível excluir a importação.')
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const unmatched = colaboradores?.unmatched ?? [];

  return (
    <div className="page-card">
      <div className="sec">Ponto (jornada)</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 12px' }}>
        Envie a planilha de jornada exportada do Pontomais (.xlsx). Semanalmente, envie o arquivo mais
        recente — ele substitui os dados do mesmo período. O custo de mão de obra é calculado a partir
        das horas reais de cada colaborador.
      </p>

      {isManager ? (
        <div style={{ marginBottom: 12 }}>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onPick} />
          <button className="mini-btn" type="button" disabled={uploadMutation.isPending} onClick={() => fileRef.current?.click()}>
            {uploadMutation.isPending ? 'Importando…' : 'Enviar planilha do ponto'}
          </button>
        </div>
      ) : null}

      {unmatched.length ? (
        <div className="det-section" style={{ marginTop: 8 }}>
          <div className="sec" style={{ fontSize: 13 }}>Nomes não vinculados ({unmatched.length})</div>
          <p className="placeholder-copy" style={{ margin: '4px 0 8px' }}>
            Estes nomes do ponto não casaram com nenhum colaborador. Vincule para que o custo entre no cálculo.
          </p>
          {unmatched.map(u => (
            <div key={u.normalizedName} className="field-row" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ minWidth: 180 }}>{u.rawName}</span>
              {isManager ? (
                <>
                  <select
                    value={links[u.normalizedName] ?? ''}
                    onChange={e => setLinks(prev => ({ ...prev, [u.normalizedName]: e.target.value }))}
                  >
                    <option value="">Selecione o colaborador…</option>
                    {(linkCollaborators ?? []).map(c => (
                      <option key={c.id} value={c.id}>{collaboratorOptionLabel(c)}</option>
                    ))}
                  </select>
                  <button
                    className="mini-btn"
                    type="button"
                    disabled={!links[u.normalizedName] || linkMutation.isPending}
                    onClick={() => linkMutation.mutate({ normalizedName: u.normalizedName, collaboratorId: links[u.normalizedName] })}
                  >
                    Vincular
                  </button>
                </>
              ) : <span className="placeholder-copy">(gestor pode vincular)</span>}
            </div>
          ))}
        </div>
      ) : null}

      <div className="sec" style={{ fontSize: 13, marginTop: 16 }}>Histórico de importações</div>
      {imports?.length ? (
        <div className="acp-table-wrap" style={{ marginTop: 8 }}>
          <table className="acp-table">
            <thead>
              <tr><th>Arquivo</th><th>Período</th><th>Colab.</th><th>Linhas</th><th>Enviado</th>{isManager ? <th /> : null}</tr>
            </thead>
            <tbody>
              {imports.map(im => (
                <tr key={im.id}>
                  <td data-label="Arquivo">{im.fileName}</td>
                  <td data-label="Período">{fmtDate(im.periodStart)} – {fmtDate(im.periodEnd)}</td>
                  <td data-label="Colab.">{im.collaboratorsMatched}/{im.collaboratorsTotal}</td>
                  <td data-label="Linhas">{im.rowsRead}</td>
                  <td data-label="Enviado">{fmtDate(im.createdAt)}</td>
                  {isManager ? (
                    <td data-label="Ações" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="mini-btn danger"
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Excluir a importação "${im.fileName}"? Os dados de ponto desse envio (custo de mão de obra) serão removidos.`)) {
                            deleteMutation.mutate(im.id);
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="placeholder-copy">Nenhuma importação ainda.</p>}
    </div>
  );
}
