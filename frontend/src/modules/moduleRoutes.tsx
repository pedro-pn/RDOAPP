import { Route } from 'react-router';

import { RoleRoute } from '../auth/RoleRoute';
import { AcompanhamentoPage } from '../pages/acompanhamento/AcompanhamentoPage';
import { AdminAccountsPage } from '../pages/admin/AdminAccountsPage';
import { EpiPage } from '../pages/epi/EpiPage';
import { EquipamentosPage } from '../pages/equipamentos/EquipamentosPage';
import { EstoquePage } from '../pages/estoque/EstoquePage';
import { PrivacyRequestsPage } from '../pages/privacy/PrivacyRequestsPage';
import { QualidadePage } from '../pages/qualidade/QualidadePage';
import { NewRomaneioPage } from '../pages/romaneio/NewRomaneioPage';
import { RomaneioPage } from '../pages/romaneio/RomaneioPage';
import { moduleRouteAccess, moduleRoutePath } from './registry';
import { ComercialPage } from '../pages/comercial/ComercialPage';
import { ConfiguracoesPage } from '../pages/comercial/configuracoes/ConfiguracoesPage';
import { CustosPage } from '../pages/comercial/custos/CustosPage';
import { HistoricoPage } from '../pages/comercial/historico/HistoricoPage';
import { PropostaPage } from '../pages/comercial/proposta/PropostaPage';
// module:scaffold import

const ADMIN_ACCOUNTS_ACCESS = moduleRouteAccess('admin', 'accounts');
const PRIVACY_ACCESS = moduleRouteAccess('privacy');
const ROMANEIO_ACCESS = moduleRouteAccess('romaneio');
const EPI_ACCESS = moduleRouteAccess('epi');
const EQUIPAMENTOS_ACCESS = moduleRouteAccess('equipamentos');
const ESTOQUE_ACCESS = moduleRouteAccess('estoque');
const QUALIDADE_ACCESS = moduleRouteAccess('qualidade');
const ACOMPANHAMENTO_ACCESS = moduleRouteAccess('acompanhamento');
const COMERCIAL_ACCESS = moduleRouteAccess('comercial');
const COMERCIAL_ESTIMATOR_ACCESS = moduleRouteAccess('comercial', 'estimator');
// A tela de configuração é do gestor: o que se muda ali — a origem de todas as
// distâncias — vale para as propostas de todo mundo.
const COMERCIAL_MANAGER_ACCESS = moduleRouteAccess('comercial', 'manager');
// module:scaffold access

export const moduleRouteElements = (
  <>
    <Route element={<RoleRoute {...ADMIN_ACCOUNTS_ACCESS} />}>
      <Route path={moduleRoutePath('admin', 'accounts')} element={<AdminAccountsPage />} />
    </Route>

    <Route element={<RoleRoute {...PRIVACY_ACCESS} />}>
      <Route path={moduleRoutePath('privacy', 'requests')} element={<PrivacyRequestsPage />} />
    </Route>

    <Route element={<RoleRoute {...ROMANEIO_ACCESS} />}>
      <Route path={moduleRoutePath('romaneio', 'index')} element={<RomaneioPage />} />
      <Route path={moduleRoutePath('romaneio', 'new')} element={<NewRomaneioPage />} />
    </Route>

    <Route element={<RoleRoute {...EPI_ACCESS} />}>
      <Route path={moduleRoutePath('epi', 'index')} element={<EpiPage />} />
    </Route>

    <Route element={<RoleRoute {...EQUIPAMENTOS_ACCESS} />}>
      <Route path={moduleRoutePath('equipamentos', 'index')} element={<EquipamentosPage />} />
    </Route>

    <Route element={<RoleRoute {...ESTOQUE_ACCESS} />}>
      <Route path={moduleRoutePath('estoque', 'index')} element={<EstoquePage />} />
    </Route>

    <Route element={<RoleRoute {...QUALIDADE_ACCESS} />}>
      <Route path={moduleRoutePath('qualidade', 'index')} element={<QualidadePage />} />
    </Route>

    <Route element={<RoleRoute {...ACOMPANHAMENTO_ACCESS} />}>
      <Route path={moduleRoutePath('acompanhamento', 'index')} element={<AcompanhamentoPage />} />
    </Route>

    <Route element={<RoleRoute {...COMERCIAL_ACCESS} />}>
      <Route path={moduleRoutePath('comercial', 'index')} element={<ComercialPage />} />
      <Route path={moduleRoutePath('comercial', 'historico')} element={<HistoricoPage />} />
    </Route>

    <Route element={<RoleRoute {...COMERCIAL_ESTIMATOR_ACCESS} />}>
      <Route path={moduleRoutePath('comercial', 'custos')} element={<CustosPage />} />
      <Route path={moduleRoutePath('comercial', 'propostas')} element={<PropostaPage />} />
    </Route>

    <Route element={<RoleRoute {...COMERCIAL_MANAGER_ACCESS} />}>
      <Route
        path={moduleRoutePath('comercial', 'configuracoes')}
        element={<ConfiguracoesPage />}
      />
    </Route>

    {/* module:scaffold routes */}    {/* module:scaffold routes */}
  </>
);
