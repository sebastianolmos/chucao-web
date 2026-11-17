import type { ListRow } from '../../lib/database.types';
import { ConceptManagementView } from '../concepts/ConceptManagementView';

type ListDetailViewProps = {
  userId: string;
  list: ListRow;
  onBack: () => void;
};

export function ListDetailView({ userId, list, onBack }: ListDetailViewProps) {
  return <ConceptManagementView userId={userId} list={list} onBack={onBack} />;
}
