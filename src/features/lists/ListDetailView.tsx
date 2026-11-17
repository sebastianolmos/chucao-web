import { Button, Stack, Text, Title } from '@mantine/core';
import type { ListRow } from '../../lib/database.types';
import { useTranslation } from 'react-i18next';
import styles from './lists.module.css';

type ListDetailViewProps = {
  list: ListRow;
  onBack: () => void;
};

export function ListDetailView({ list, onBack }: ListDetailViewProps) {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="list-detail-title"
      className={styles.view}
    >
      <Stack gap="md">
        <Button onClick={onBack} variant="subtle">
          {t('detail.back')}
        </Button>
        <Title order={1} id="list-detail-title">
          {list.name}
        </Title>
        <Text>{t('detail.empty')}</Text>
      </Stack>
    </section>
  );
}
