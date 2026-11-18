import { Button, Group, TextInput } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { validateListName } from './listService';
import styles from './lists.module.css';

type FormValues = {
  name: string;
};

type ListNameFormProps = {
  disabled: boolean;
  onSubmit: (rawName: string) => Promise<boolean>;
  onCancel: () => void;
};

export function ListNameForm({
  disabled,
  onSubmit,
  onCancel,
}: ListNameFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '' },
    mode: 'onSubmit',
  });

  async function submit(values: FormValues) {
    const validation = validateListName(values.name);

    if (!validation.valid) {
      setError('name', {
        type: validation.trimmedName.length === 0 ? 'required' : 'tooLong',
      });
      return;
    }

    if (await onSubmit(values.name)) {
      reset();
    }
  }

  const fieldError = errors.name?.type === 'tooLong'
    ? t('validation.tooLong')
    : errors.name
      ? t('validation.required')
      : undefined;

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      <TextInput
        {...register('name')}
        aria-describedby={fieldError ? 'list-name-error' : undefined}
        error={fieldError}
        id="list-name"
        label={t('lists.name')}
        maxLength={120}
      />
      {fieldError && (
        <span id="list-name-error" role="alert">
          {fieldError}
        </span>
      )}
      <Group className={styles.formActions} justify="center">
        <Button className={styles.saveListButton} disabled={disabled} loading={disabled} type="submit">
          {t('lists.submit')}
        </Button>
        <Button className={styles.cancelListButton} disabled={disabled} onClick={onCancel} type="button">
          {t('concepts.cancel')}
        </Button>
      </Group>
    </form>
  );
}
