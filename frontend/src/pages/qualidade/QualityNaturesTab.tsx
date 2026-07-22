import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createQualityNature,
  listQualityNatures,
  removeQualityNature,
  setQualityNatureActive,
  type QualityNature,
  type QualityNaturePayload,
  updateQualityNature
} from '../../api/qualidade';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SearchBar } from '../../components/ui/SearchBar';
import { useToast } from '../../components/ui/ToastContext';
import { QualityNatureFormModal } from './QualityNatureFormModal';

interface Props {
  isManager: boolean;
}

type ConfirmState = {
  title: string;
  description?: string;
  highlight?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
};

export function QualityNaturesTab({ isManager }: Props) {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formNature, setFormNature] = useState<QualityNature | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const naturesQuery = useQuery({
    queryKey: ['qualidade', 'naturezas', { includeInactive }],
    queryFn: () => listQualityNatures({ includeInactive })
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['qualidade', 'naturezas'] });
    queryClient.invalidateQueries({ queryKey: ['qualidade', 'registros'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: QualityNaturePayload) => createQualityNature(payload),
    onSuccess: () => {
      invalidate();
      setFormNature(undefined);
      showToast('Natureza cadastrada.', 'success');
    },
    onError: error => showToast(error instanceof Error ? error.message : 'Não foi possível cadastrar.', 'error')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: QualityNaturePayload }) => updateQualityNature(id, payload),
    onSuccess: () => {
      invalidate();
      setFormNature(undefined);
      showToast('Natureza salva.', 'success');
    },
    onError: error => showToast(error instanceof Error ? error.message : 'Não foi possível salvar.', 'error')
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setQualityNatureActive(id, isActive),
    onSuccess: () => {
      invalidate();
      showToast('Status atualizado.', 'success');
    },
    onError: error => showToast(error instanceof Error ? error.message : 'Não foi possível atualizar.', 'error')
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeQualityNature(id),
    onSuccess: () => {
      invalidate();
      showToast('Natureza removida.', 'success');
    },
    onError: error => showToast(error instanceof Error ? error.message : 'Não foi possível remover.', 'error')
  });

  const natures = useMemo(() => {
    const rows = naturesQuery.data || [];
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(nature => nature.name.toLowerCase().includes(query));
  }, [naturesQuery.data, search]);
  const saving = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(payload: QualityNaturePayload) {
    if (formNature) updateMutation.mutate({ id: formNature.id, payload });
    else createMutation.mutate(payload);
  }

  function confirmActive(nature: QualityNature, isActive: boolean) {
    setConfirm({
      title: isActive ? 'Reativar Natureza' : 'Inativar Natureza',
      description: isActive ? 'Ela voltará a aparecer em novos registros.' : 'Ela deixará de aparecer em novos registros, mas seguirá visível nos registros antigos.',
      highlight: nature.name,
      confirmLabel: isActive ? 'Reativar' : 'Inativar',
      danger: false,
      onConfirm: () => activeMutation.mutate({ id: nature.id, isActive })
    });
  }

  function confirmRemove(nature: QualityNature) {
    setConfirm({
      title: 'Excluir Natureza',
      description: nature.inUse ? 'Naturezas em uso não podem ser excluídas; use Inativar.' : 'A Natureza será removida do cadastro.',
      highlight: nature.name,
      confirmLabel: 'Excluir',
      onConfirm: () => removeMutation.mutate(nature.id)
    });
  }

  return (
    <section className="page-card quality-tab" data-quality-natures>
      <div className="admin-toolbar">
        <div>
          <div className="sec">Naturezas</div>
          <p className="rel-meta">Categorias padronizadas usadas no formulário e na recorrência.</p>
        </div>
        {isManager ? <button className="mini-btn" type="button" onClick={() => setFormNature(null)}>Nova Natureza</button> : null}
      </div>

      <div className="nps-tab-toolbar">
        <div className="nps-tab-toolbar-left">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar Natureza"
            ariaLabel="Buscar Natureza"
            count={{ shown: natures.length, total: natures.length }}
          />
        </div>
        <div className="nps-tab-toolbar-right">
          <label className="equip-toggle">
            <input type="checkbox" checked={includeInactive} onChange={event => setIncludeInactive(event.target.checked)} />
            <span>Inativas</span>
          </label>
        </div>
      </div>

      {naturesQuery.isLoading ? <p className="placeholder-copy">Carregando Naturezas...</p> : null}
      {naturesQuery.isError ? <p className="equip-form-error">Não foi possível carregar as Naturezas.</p> : null}
      {!naturesQuery.isLoading && !natures.length ? <p className="placeholder-copy">Nenhuma Natureza encontrada.</p> : null}

      <div className="equip-grid">
        {natures.map(nature => (
          <article className="card" key={nature.id}>
            <div className="admin-toolbar">
              <div>
                <div className="sec">{nature.name}</div>
                <p className="rel-meta">{nature.recordCount} registro(s) vinculado(s)</p>
              </div>
              <span className={`badge ${nature.isActive ? 'badge-ok' : 'danger'}`}>{nature.isActive ? 'Ativa' : 'Inativa'}</span>
            </div>
            <p className="rel-meta">{nature.inUse ? 'Exclusão bloqueada por vínculo com registros.' : 'Sem registros vinculados.'}</p>
            {isManager ? (
              <div className="admin-form-actions">
                <button className="mini-btn alt" type="button" onClick={() => setFormNature(nature)}>Editar</button>
                <button className="mini-btn alt" type="button" onClick={() => confirmActive(nature, !nature.isActive)}>
                  {nature.isActive ? 'Inativar' : 'Reativar'}
                </button>
                <button className="danger-button" type="button" onClick={() => confirmRemove(nature)}>Excluir</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {formNature !== undefined ? (
        <QualityNatureFormModal
          open
          nature={formNature}
          saving={saving}
          onClose={() => setFormNature(undefined)}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        description={confirm?.description}
        highlight={confirm?.highlight}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
