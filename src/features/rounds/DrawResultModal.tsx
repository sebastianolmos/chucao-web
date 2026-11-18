import { Button, Modal, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import styles from './rounds.module.css';

type Props = {
  title: string;
  appearanceOrder: number;
  opened: boolean;
  onReturn: () => void;
  onPractice: () => void;
};

export function DrawResultModal({ title, appearanceOrder, opened, onReturn, onPractice }: Props) {
  const { t } = useTranslation();

  return (
    <Modal
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
      onClose={onReturn}
      opened={opened}
      withCloseButton={false}
      title={t('rounds.drawResultTitle')}
      classNames={{
        content: styles.roundModalContent,
        header: styles.roundModalHeader,
        title: styles.roundModalTitle,
        body: styles.roundModalBody,
      }}
      overlayProps={{ className: styles.roundModalOverlay }}
    >
      <div className={styles.drawResult}>
        <Title className={styles.drawResultConcept} order={2}>
          {title}
        </Title>
        <Text className={styles.drawResultOrder}>
          {t('rounds.drawResultOrder', { order: appearanceOrder })}
        </Text>
        <Button className={styles.drawPracticeButton} onClick={onPractice} type="button">
          {t('rounds.practice')}
        </Button>
        <Button className={styles.drawReturnButton} onClick={onReturn} type="button">
          {t('rounds.returnToList')}
        </Button>
      </div>
    </Modal>
  );
}
