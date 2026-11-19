import type { ListRow } from '../../lib/database.types';
import { ConceptManagementView } from '../concepts/ConceptManagementView';

export type RoundActionRequest = {
  id: number;
  listId: string;
  action: 'draw' | 'new_round';
};

type ListDetailViewProps = {
  userId: string;
  list: ListRow;
  onBack: () => void;
  onStartPractice: (conceptId: string, roundId?: string | null, appearanceId?: string | null) => void;
  pendingRoundAction?: RoundActionRequest | null;
  onRoundActionRequestHandled?: (requestId: number) => void;
};

export function ListDetailView({ userId, list, onBack, onStartPractice, pendingRoundAction, onRoundActionRequestHandled }: ListDetailViewProps) {
  return (
    <ConceptManagementView
      userId={userId}
      list={list}
      onBack={onBack}
      onStartPractice={onStartPractice}
      pendingRoundAction={pendingRoundAction}
      onRoundActionRequestHandled={onRoundActionRequestHandled}
    />
  );
}
