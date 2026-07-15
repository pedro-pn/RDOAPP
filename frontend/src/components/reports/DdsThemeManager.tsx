import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createDdsTheme, deactivateDdsTheme, listDdsThemes, updateDdsTheme } from '../../api/ddsThemes';
import { useToast } from '../ui/ToastContext';

// Administração da lista de temas de DDS. Permite adicionar, renomear e desativar/reativar.
export function DdsThemeManager() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['dds-themes', 'all'], queryFn: () => listDdsThemes(true) });

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dds-themes'] });

  const createMutation = useMutation({
    mutationFn: (name: string) => createDdsTheme(name),
    onSuccess: () => { showToast('Tema adicionado.'); setNewName(''); invalidate(); },
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

  return (
    <div className="page-card">
      <div className="sec">Temas de DDS</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 10px' }}>
        Lista usada no registro de DDS dos RDOs. Temas inativos não aparecem na seleção.
      </p>
      <div className="inline-add-row" style={{ marginBottom: 12 }}>
        <input
          placeholder="Novo tema"
          value={newName}
          aria-label="Novo tema de DDS"
          onChange={event => setNewName(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (!newName.trim() || createMutation.isPending) return;
            createMutation.mutate(newName.trim());
          }}
        />
        <button
          className="mini-btn"
          type="button"
          disabled={createMutation.isPending || !newName.trim()}
          onClick={() => createMutation.mutate(newName.trim())}
        >
          Adicionar
        </button>
      </div>
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
