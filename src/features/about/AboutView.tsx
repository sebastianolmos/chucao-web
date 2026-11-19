import { useTranslation } from 'react-i18next';
import styles from '../../app/app.module.css';

export function AboutView({
  onBack,
  showSignInStep = false,
  detailed = false,
}: {
  onBack: () => void;
  showSignInStep?: boolean;
  detailed?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <article aria-labelledby="about-title" className={styles.aboutView}>
      <h1 id="about-title">{t('about.title')}</h1>
      <p>{t('about.intro')}</p>
      <p>{t('about.purpose')}</p>

      <h2>{t('about.howTitle')}</h2>
      <ol>
        {showSignInStep && <li>{t('about.stepSignIn')}</li>}
        <li>{t('about.stepLists')}</li>
        <li>{t('about.stepConcepts')}</li>
        <li>{t('about.stepRounds')}</li>
        <li>{t('about.stepTimer')}</li>
        <li>{t('about.stepHistory')}</li>
      </ol>

      <h2>{t('about.featuresTitle')}</h2>
      <ul>
        <li><strong>{t('about.listsTitle')}</strong> {t('about.lists')}</li>
        <li><strong>{t('about.roundsTitle')}</strong> {t('about.rounds')}</li>
        <li><strong>{t('about.timerTitle')}</strong> {t('about.timer')}</li>
        <li><strong>{t('about.historyTitle')}</strong> {t('about.history')}</li>
        <li><strong>{t('about.organizationTitle')}</strong> {t('about.organization')}</li>
        <li><strong>{t('about.preferencesTitle')}</strong> {t('about.preferences')}</li>
      </ul>

      {detailed && (
        <>
          <h2>{t('about.moreTitle')}</h2>
          <p>{t('about.morePractice')}</p>
          <p>{t('about.moreOrganization')}</p>
        </>
      )}

      <h2>{t('about.privacyTitle')}</h2>
      <p>{t('about.privacy')}</p>
      <p>{t('about.limits')}</p>
      <button onClick={onBack} type="button">{t('about.back')}</button>
    </article>
  );
}
