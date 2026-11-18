import type { ListRow } from '../../lib/database.types';
import { ConceptManagementView } from '../concepts/ConceptManagementView';

type ListDetailViewProps = {
  userId: string;
  list: ListRow;
  onBack: () => void;
  onStartPractice: (conceptId: string) => void;
};

export function ListDetailView({ userId, list, onBack, onStartPractice }: ListDetailViewProps) {
  return <ConceptManagementView userId={userId} list={list} onBack={onBack} onStartPractice={onStartPractice} />;
}
