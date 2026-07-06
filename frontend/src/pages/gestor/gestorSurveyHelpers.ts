import type { Project, SatisfactionSurveySummary } from '../../types/domain';
import type { SurveyQuestion, SurveyQuestionType, SurveyResponses } from '../../api/surveys';

export type SurveyQuestionDraft = Omit<SurveyQuestion, 'order' | 'options'> & { optionsText: string };

export function formatDate(value?: string | null) {
  if (!value) return 'Não informado';
  return new Date(value).toLocaleDateString('pt-BR');
}

export function latestSurvey(project: Project) {
  return (project.surveys || [])[0] || null;
}

export function surveyIsActive(survey?: SatisfactionSurveySummary | null) {
  return !!survey && !survey.respondedAt && new Date(survey.expiresAt).getTime() > Date.now();
}

export function surveyIsExpired(survey?: SatisfactionSurveySummary | null) {
  return !!survey && !survey.respondedAt && new Date(survey.expiresAt).getTime() <= Date.now();
}

export function surveyBadge(survey?: SatisfactionSurveySummary | null) {
  if (!survey) return { label: 'Pesquisa não enviada', className: 'badge badge-pen' };
  if (survey.respondedAt) return { label: 'Pesquisa respondida', className: 'badge badge-ok' };
  if (new Date(survey.expiresAt).getTime() <= Date.now()) return { label: 'Pesquisa expirada', className: 'badge badge-rev' };
  if (survey.reminderOptOutAt) return { label: 'Lembretes cancelados', className: 'badge badge-pen' };
  return { label: 'Pesquisa enviada', className: 'badge badge-pen' };
}

export function surveyHistoryBadges(project: Project) {
  const surveys = project.surveys || [];
  if (!surveys.length) return [surveyBadge(null)];
  return surveys.map((survey, index) => {
    const badge = surveyBadge(survey);
    const date = formatDate(survey.respondedAt || survey.sentAt || survey.createdAt);
    return {
      ...badge,
      label: surveys.length > 1 ? `${badge.label} #${surveys.length - index} - ${date}` : `${badge.label} - ${date}`
    };
  });
}

export function projectChangedAfterSurvey(project: Project, survey: SatisfactionSurveySummary) {
  const projectUpdatedAt = project.updatedAt ? new Date(project.updatedAt).getTime() : 0;
  const surveyReferenceAt = new Date(survey.respondedAt || survey.createdAt).getTime();
  return Boolean(projectUpdatedAt && surveyReferenceAt && projectUpdatedAt > surveyReferenceAt);
}

export function canSendProjectSurvey(project: Project) {
  if (project.isActive) return false;
  const survey = latestSurvey(project);
  if (!survey) return true;
  if (surveyIsActive(survey)) return false;
  if (survey.respondedAt) return projectChangedAfterSurvey(project, survey);
  return true;
}

export function surveyStatusLabel(survey: SatisfactionSurveySummary) {
  if (survey.respondedAt) return { label: 'Respondida', className: 'status-approved' };
  if (surveyIsExpired(survey)) return { label: 'Expirada', className: 'status-returned' };
  return { label: 'Pendente', className: 'status-pending' };
}

export function surveyResponseValue(value: unknown, fallback = 'Não respondido') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

const legacyNpsResponseLabels: Record<string, string> = {
  nps: 'Probabilidade de recomendar a Filtrovali',
  serviceQuality: 'Qualidade dos serviços prestados',
  communication: 'Comunicação da equipe durante o projeto',
  deadlines: 'Cumprimento de prazos',
  documentation: 'Qualidade da documentação entregue',
  improvement: 'O que podemos melhorar?',
  highlight: 'Algo que gostaria de destacar?'
};

export function npsResponseRows(responses?: SurveyResponses | null, questions: SurveyQuestion[] = []) {
  if (questions.length) {
    return questions.map(question => [question.label, surveyResponseValue(responses?.[question.id])]);
  }
  return Object.keys(responses || {}).map(key => [
    legacyNpsResponseLabels[key] || key,
    surveyResponseValue(responses?.[key])
  ]);
}

export function npsProjectTitle(survey: SatisfactionSurveySummary & { project?: { code?: string; name?: string } | null }) {
  return [survey.project?.code, survey.project?.name].filter(Boolean).join(' - ') || 'Projeto não informado';
}

export function npsProjectKey(survey: SatisfactionSurveySummary & { project?: { id?: string } | null }) {
  return survey.project?.id || survey.projectId || survey.id;
}

export function surveyQuestionToDraft(question: SurveyQuestion): SurveyQuestionDraft {
  return {
    id: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    optionsText: (question.options || []).join('\n')
  };
}

export function newSurveyQuestionDraft(): SurveyQuestionDraft {
  return {
    id: `new-${Date.now()}`,
    label: '',
    type: 'TEXT',
    required: false,
    optionsText: ''
  };
}

export function draftToSurveyQuestion(question: SurveyQuestionDraft): Omit<SurveyQuestion, 'order'> {
  const options = question.type === 'SELECT'
    ? question.optionsText
      .split(/\n|,/)
      .map(option => option.trim())
      .filter(Boolean)
    : [];
  return {
    id: question.id,
    label: question.label.trim(),
    type: question.type,
    required: question.required,
    options
  };
}

export function surveyDraftOptions(question: SurveyQuestionDraft) {
  return question.optionsText
    .split(/\n|,/)
    .map(option => option.trim())
    .filter(Boolean);
}

export function scalePreviewValues(type: SurveyQuestionType) {
  if (type === 'NPS') return Array.from({ length: 11 }, (_, index) => index);
  if (type === 'SCALE') return [1, 2, 3, 4, 5];
  return [];
}
