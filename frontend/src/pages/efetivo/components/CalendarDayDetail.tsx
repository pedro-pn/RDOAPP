import type { CalendarEvent } from '../../../api/efetivoPlanning';
import { displayDateOnly } from '../../../utils/calendarGrid';

const typeLabel: Record<CalendarEvent['type'], string> = { MISSION: 'Missão', FERIAS: 'Férias', FOLGA: 'Folga', AFASTAMENTO: 'Afastamento' };

export function CalendarDayDetail({ date, events }: { date: string; events: CalendarEvent[] }) {
  const matching = events.filter(event => event.startDate <= date && event.endDate >= date);
  return (
    <aside className="page-card efetivo-day-detail" data-efetivo-calendar-day>
      <div className="efetivo-section-heading"><div><h2>{displayDateOnly(date, { weekday: 'long', day: '2-digit', month: 'long' })}</h2><p>Eventos, pessoas e vagas desta data.</p></div></div>
      {matching.length ? <div className="efetivo-compact-list">{matching.map(event => (
        <a key={`${event.type}-${event.id}`} href={event.entityPath}>
          <strong><span className={`efetivo-event-dot type-${event.type.toLocaleLowerCase('pt-BR')}`} />{event.title}</strong>
          <span>{typeLabel[event.type]} · {displayDateOnly(event.startDate)} a {displayDateOnly(event.endDate)}{event.demand != null ? ` · ${event.allocated}/${event.demand} alocados` : ''}</span>
        </a>
      ))}</div> : <p className="placeholder-copy">Nenhum evento neste dia.</p>}
    </aside>
  );
}
