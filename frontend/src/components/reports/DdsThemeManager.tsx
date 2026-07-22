import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createDdsTheme, deactivateDdsTheme, listDdsThemes, updateDdsTheme } from '../../api/ddsThemes';
import { useToast } from '../ui/ToastContext';

// Administração da lista de temas de DDS. Permite adicionar, renomear e desativar/reativar.
export function DdsThemeManager() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['dds-themes', 'all'], queryFn: () => listDdsThemes(true) });

  const [newName, setNewName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dds-themes'] });

  const createMutation = useMutation({
    mutationFn: (name: string) => createDdsTheme(name),
    onSuccess: () => { showToast('Tema adicionado.'); setNewName(''); setShowCreateForm(false); invalidate(); },
    onError: () => showToast('Não foi possível adicionar (nome já existe?).')
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: { name?: string; isActive?: boolean } }) => updateDdsTheme(payload.id, payload.data),
    onSuccess: () => { showToast('Tema atualizado.'); setEditing(null); invalidate(); },
    onError: () => showToast('Não foi possível atualizar o tema.')
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateDdsTheme(id),
    onSuccess: () => { showToast('Tema desativado.'); invalidate(); },
    onError: () => showToast('Não foi possível desativar o tema.')
  });

  const themes = data ?? [];

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || createMutation.isPending) return;
    createMutation.mutate(name);
  }

  return (
    <div className="page-card">
      <div className="admin-toolbar">
        <div className="sec">Temas de DDS</div>
        {!showCreateForm ? (
          <button className="mini-btn" type="button" onClick={() => setShowCreateForm(true)}>
            + Novo tema
          </button>
        ) : null}
      </div>
      <p className="placeholder-copy" style={{ margin: '4px 0 10px' }}>
        Lista usada no registro de DDS dos RDOs. Temas inativos não aparecem na seleção.
      </p>
      {showCreateForm ? (
        <form className="admin-inline-form" onSubmit={handleCreateSubmit} autoComplete="off">
          <div className="admin-toolbar full">
            <div className="sec">Novo tema de DDS</div>
            <button className="mini-btn alt" type="button" onClick={() => { setShowCreateForm(false); setNewName(''); }}>
              Cancelar
            </button>
          </div>
          <div className="admin-inline-grid">
            <div className="field-group field-group-wide">
              <label htmlFor="dds-theme-name">Nome do tema</label>
              <input
                id="dds-theme-name"
                value={newName}
                autoComplete="off"
                onChange={event => setNewName(event.target.value)}
                required
              />
            </div>
            <div className="admin-form-actions">
              <button className="mini-btn" type="submit" disabled={createMutation.isPending || !newName.trim()}>
                Salvar
              </button>
            </div>
          </div>
        </form>
      ) : null}
      {isLoading ? (
        <div className="placeholder-copy">Carregando temas…</div>
      ) : (
        <ul className="admin-stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {themes.map(theme => (
            <li key={theme.id} className="det-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {editing?.id === theme.id ? (
                <>
                  <input
                    style={{ flex: 1 }}
                    value={editing.name}
                    onChange={event => setEditing({ id: theme.id, name: event.target.value })}
                  />
                  <button
                    className="mini-btn"
                    type="button"
                    disabled={updateMutation.isPending || !editing.name.trim()}
                    onClick={() => updateMutation.mutate({ id: theme.id, data: { name: editing.name.trim() } })}
                  >
                    Salvar
                  </button>
                  <button className="mini-btn alt" type="button" onClick={() => setEditing(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, opacity: theme.isActive ? 1 : 0.5 }}>
                    {theme.name}{theme.isActive ? '' : ' (inativo)'}
                  </span>
                  <button className="mini-btn" type="button" onClick={() => setEditing({ id: theme.id, name: theme.name })}>Renomear</button>
                  {theme.isActive ? (
                    <button className="mini-btn danger" type="button" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(theme.id)}>Desativar</button>
                  ) : (
                    <button className="mini-btn" type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: theme.id, data: { isActive: true } })}>Reativar</button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
