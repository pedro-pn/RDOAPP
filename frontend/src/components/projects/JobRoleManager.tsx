import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createJobRole,
  deactivateJobRole,
  listJobRoles,
  updateJobRole,
  type JobRole
} from '../../api/jobRoles';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  Skeleton,
  StatusPill,
  type DataTableColumn
} from '../ui/ds';
import { useToast } from '../ui/ToastContext';
import '../../styles/rdo-ds-actions.css';
import './JobRoleManager.ds.css';

export type JobRoleManagerAppearance = 'legacy' | 'design-system';

export interface JobRoleManagerProps {
  appearance?: JobRoleManagerAppearance;
}

// Administração da lista de cargos (JobRole). Permite adicionar, renomear e desativar/reativar.
export function JobRoleManager({ appearance = 'legacy' }: JobRoleManagerProps) {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['job-roles', 'all'], queryFn: () => listJobRoles(true) });

  const [newName, setNewName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const designSystemSurfaceRef = useRef<HTMLElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const renameLauncherIdRef = useRef<string | null>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['job-roles'] });

  const createMutation = useMutation({
    mutationFn: (name: string) => createJobRole(name),
    onSuccess: () => { showToast('Cargo adicionado.'); setNewName(''); setShowCreateForm(false); invalidate(); },
    onError: () => showToast('Não foi possível adicionar (nome já existe?).')
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: { name?: string; isActive?: boolean } }) => updateJobRole(payload.id, payload.data),
    onSuccess: () => { showToast('Cargo atualizado.'); setEditing(null); invalidate(); },
    onError: () => showToast('Não foi possível atualizar o cargo.')
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateJobRole(id),
    onSuccess: () => { showToast('Cargo desativado.'); invalidate(); },
    onError: () => showToast('Não foi possível desativar o cargo.')
  });

  const roles = data ?? [];
  const editingId = editing?.id;

  useEffect(() => {
    if (appearance === 'design-system' && showCreateForm) {
      createInputRef.current?.focus();
    }
  }, [appearance, showCreateForm]);

  useEffect(() => {
    if (appearance === 'design-system' && editingId) {
      editingInputRef.current?.focus();
    }
  }, [appearance, editingId]);

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || createMutation.isPending) return;
    createMutation.mutate(name);
  }

  function restoreDesignSystemLauncherFocus(selector: string) {
    window.requestAnimationFrame(() => {
      designSystemSurfaceRef.current
        ?.querySelector<HTMLButtonElement>(selector)
        ?.focus();
    });
  }

  function cancelDesignSystemCreate() {
    setShowCreateForm(false);
    setNewName('');
    restoreDesignSystemLauncherFocus('[data-job-role-create]');
  }

  function openDesignSystemRename(role: JobRole) {
    renameLauncherIdRef.current = role.id;
    setEditing({ id: role.id, name: role.name });
  }

  function cancelDesignSystemRename() {
    const launcherId = renameLauncherIdRef.current;
    setEditing(null);
    if (launcherId) {
      restoreDesignSystemLauncherFocus(
        `[data-job-role-rename="${launcherId}"]`
      );
    }
  }

  function handleDesignSystemEscape(
    event: KeyboardEvent<HTMLElement>,
    onCancel: () => void
  ) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }

  function renderDesignSystemRoleName(role: JobRole) {
    if (editing?.id === role.id) {
      return (
        <Field
          className="rdo-job-roles__rename-field"
          label="Novo nome"
          optionalText={null}
        >
          <Input
            ref={editingInputRef}
            size="lg"
            value={editing.name}
            aria-label={`Novo nome para ${role.name}`}
            onChange={(event) =>
              setEditing({ id: role.id, name: event.target.value })
            }
            onKeyDown={(event) =>
              handleDesignSystemEscape(event, cancelDesignSystemRename)
            }
          />
        </Field>
      );
    }

    return (
      <span className="rdo-job-roles__name" data-job-role-name={role.name}>
        {role.name}
      </span>
    );
  }

  function renderDesignSystemRoleActions(role: JobRole) {
    if (editing?.id === role.id) {
      return (
        <>
          <Button
            size="md"
            variant="primary"
            disabled={updateMutation.isPending || !editing.name.trim()}
            loading={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                id: role.id,
                data: { name: editing.name.trim() }
              })
            }
          >
            Salvar
          </Button>
          <Button
            size="md"
            variant="secondary"
            onClick={cancelDesignSystemRename}
          >
            Cancelar
          </Button>
        </>
      );
    }

    return (
      <>
        <Button
          size="md"
          variant="secondary"
          data-job-role-rename={role.id}
          onClick={() => openDesignSystemRename(role)}
        >
          Renomear
        </Button>
        {role.isActive ? (
          <Button
            size="md"
            variant="danger"
            disabled={deactivateMutation.isPending}
            loading={deactivateMutation.isPending}
            onClick={() => deactivateMutation.mutate(role.id)}
          >
            Desativar
          </Button>
        ) : (
          <Button
            size="md"
            variant="secondary"
            disabled={updateMutation.isPending}
            loading={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                id: role.id,
                data: { isActive: true }
              })
            }
          >
            Reativar
          </Button>
        )}
      </>
    );
  }

  if (appearance === 'design-system') {
    const columns: readonly DataTableColumn<JobRole>[] = [
      {
        key: 'name',
        header: 'Cargo',
        rowHeader: true,
        render: renderDesignSystemRoleName
      },
      {
        key: 'status',
        header: 'Status',
        render: (role) => (
          <StatusPill
            status={role.isActive ? 'ACTIVE' : 'INACTIVE'}
            label={role.isActive ? 'Ativo' : 'Inativo'}
            tone={role.isActive ? 'success' : 'neutral'}
          />
        )
      }
    ];

    return (
      <section
        ref={designSystemSurfaceRef}
        className="fv-ds rdo-job-roles rdo-ds-actions"
        aria-labelledby="rdo-job-roles-title"
      >
        <Card
          className="rdo-job-roles__card"
          padding="md"
          title={<h2 id="rdo-job-roles-title">Cargos</h2>}
          actions={
            !showCreateForm ? (
              <Button
                data-job-role-create
                size="md"
                variant="primary"
                onClick={() => setShowCreateForm(true)}
              >
                Novo cargo
              </Button>
            ) : null
          }
        >
          <p className="rdo-job-roles__description">
            Lista usada no cadastro de colaboradores. Cargos inativos não
            aparecem na seleção.
          </p>

          {showCreateForm ? (
            <form
              className="rdo-job-roles__create-form"
              onSubmit={handleCreateSubmit}
              onKeyDown={(event) =>
                handleDesignSystemEscape(event, cancelDesignSystemCreate)
              }
              autoComplete="off"
            >
              <Field label="Nome do cargo" required>
                <Input
                  ref={createInputRef}
                  size="lg"
                  value={newName}
                  autoComplete="off"
                  onChange={(event) => setNewName(event.target.value)}
                  required
                />
              </Field>
              <div className="rdo-job-roles__form-actions">
                <Button
                  size="md"
                  variant="secondary"
                  onClick={cancelDesignSystemCreate}
                >
                  Cancelar
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  type="submit"
                  disabled={createMutation.isPending || !newName.trim()}
                  loading={createMutation.isPending}
                >
                  Salvar
                </Button>
              </div>
            </form>
          ) : null}

          {isLoading ? (
            <Skeleton
              className="rdo-job-roles__loading"
              variant="table-rows"
              lines={6}
              label="Carregando cargos…"
            />
          ) : (
            <DataTable
              className="rdo-job-roles__table"
              rows={roles}
              columns={columns}
              getRowId={(role) => role.id}
              getRowClassName={(role) =>
                role.isActive
                  ? 'rdo-job-roles__row'
                  : 'rdo-job-roles__row rdo-job-roles__row--inactive'
              }
              ariaLabel="Cargos"
              density="compact"
              actionsLabel="Ações"
              rowActions={renderDesignSystemRoleActions}
              emptyState={
                <EmptyState
                  title="Nenhum cargo cadastrado."
                  description="Cadastre um cargo para disponibilizá-lo na seleção de colaboradores."
                />
              }
              mobile={{
                ariaLabel: 'Cargos',
                renderItem: (role) => ({
                  title: renderDesignSystemRoleName(role),
                  status: (
                    <StatusPill
                      status={role.isActive ? 'ACTIVE' : 'INACTIVE'}
                      label={role.isActive ? 'Ativo' : 'Inativo'}
                      tone={role.isActive ? 'success' : 'neutral'}
                    />
                  ),
                  actions: renderDesignSystemRoleActions(role)
                })
              }}
            />
          )}
        </Card>
      </section>
    );
  }

  return (
    <div className="page-card">
      <div className="admin-toolbar">
        <div className="sec">Cargos</div>
        {!showCreateForm ? (
          <button className="mini-btn" type="button" onClick={() => setShowCreateForm(true)}>
            + Novo cargo
          </button>
        ) : null}
      </div>
      <p className="placeholder-copy" style={{ margin: '4px 0 10px' }}>
        Lista usada no cadastro de colaboradores. Cargos inativos não aparecem na seleção.
      </p>
      {showCreateForm ? (
        <form className="admin-inline-form" onSubmit={handleCreateSubmit} autoComplete="off">
          <div className="admin-toolbar full">
            <div className="sec">Novo cargo</div>
            <button className="mini-btn alt" type="button" onClick={() => { setShowCreateForm(false); setNewName(''); }}>
              Cancelar
            </button>
          </div>
          <div className="admin-inline-grid">
            <div className="field-group field-group-wide">
              <label htmlFor="job-role-name">Nome do cargo</label>
              <input
                id="job-role-name"
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
        <div className="placeholder-copy">Carregando cargos…</div>
      ) : (
        <ul className="admin-stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {roles.map(role => (
            <li key={role.id} className="det-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {editing?.id === role.id ? (
                <>
                  <input
                    style={{ flex: 1 }}
                    value={editing.name}
                    onChange={event => setEditing({ id: role.id, name: event.target.value })}
                  />
                  <button
                    className="mini-btn"
                    type="button"
                    disabled={updateMutation.isPending || !editing.name.trim()}
                    onClick={() => updateMutation.mutate({ id: role.id, data: { name: editing.name.trim() } })}
                  >
                    Salvar
                  </button>
                  <button className="mini-btn alt" type="button" onClick={() => setEditing(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, opacity: role.isActive ? 1 : 0.5 }}>
                    {role.name}{role.isActive ? '' : ' (inativo)'}
                  </span>
                  <button className="mini-btn" type="button" onClick={() => setEditing({ id: role.id, name: role.name })}>Renomear</button>
                  {role.isActive ? (
                    <button className="mini-btn danger" type="button" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(role.id)}>Desativar</button>
                  ) : (
                    <button className="mini-btn" type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: role.id, data: { isActive: true } })}>Reativar</button>
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
