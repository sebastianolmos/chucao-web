export type Locale = 'es' | 'en';

export type ProfileRow = {
  id: string;
  locale: Locale | null;
  default_timer_minutes: number | null;
  completion_sound_enabled: boolean | null;
  sound_volume: number | null;
  reduced_motion: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ListRow = {
  id: string;
  owner_id: string;
  name: string;
  name_normalized: string;
  created_at: string;
  updated_at: string;
};

export type ConceptState = 'pending' | 'seen';

export type RoundStatus = 'open' | 'closed';

export type RoundAppearanceOrigin = 'draw' | 'manual';

export type RoundAction = 'mark_seen' | 'draw' | 'return_pending' | 'new_round';

export type RoundOperationOutcome = 'applied' | 'rejected' | 'exhausted';

export type RoundResultState = ConceptState | 'closed' | null;

export type RoundRow = {
  id: string;
  list_id: string | null;
  status: RoundStatus;
  opened_at: string | null;
  closed_at: string | null;
  anonymous_appearance_total: number | null;
  created_at: string | null;
};

export type RoundAppearanceRow = {
  id: string;
  round_id: string;
  concept_id: string | null;
  appearance_order: number;
  origin: RoundAppearanceOrigin;
  title_snapshot: string | null;
  concept_deleted: boolean;
  created_at: string;
};

export type RoundOperationRow = {
  list_id: string;
  operation_id: string;
  round_id: string;
  action: RoundAction;
  outcome: RoundOperationOutcome;
  appearance_id: string | null;
  concept_id: string | null;
  result_state: RoundResultState;
  created_at: string;
};

export type RoundOperationResult = {
  action: RoundAction;
  outcome: RoundOperationOutcome;
  round_id: string;
  appearance_id: string | null;
  appearance_order: number | null;
  concept_id: string | null;
  title: string | null;
  result_state: RoundResultState;
  pending_count: number;
  seen_count: number;
};

export type ConceptRow = {
  id: string;
  list_id: string;
  title: string | null;
  description: string | null;
  state: ConceptState;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ActiveConceptRow = Omit<
  ConceptRow,
  'title' | 'description' | 'deleted_at'
> & {
  title: string;
  description: string;
  deleted_at: null;
};

export type ConceptBatchItem = {
  title: string;
  description: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          locale?: Locale | null;
          default_timer_minutes?: number | null;
          completion_sound_enabled?: boolean | null;
          sound_volume?: number | null;
          reduced_motion?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          locale?: Locale | null;
          default_timer_minutes?: number | null;
          completion_sound_enabled?: boolean | null;
          sound_volume?: number | null;
          reduced_motion?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lists: {
        Row: ListRow;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          name_normalized: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          name_normalized?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      concepts: {
        Row: ConceptRow;
        Insert: {
          id?: string;
          list_id: string;
          title?: string | null;
          description?: string | null;
          state?: ConceptState;
          position: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          list_id?: string;
          title?: string | null;
          description?: string | null;
          state?: ConceptState;
          position?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'concepts_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'lists';
            referencedColumns: ['id'];
          },
        ];
      };
      rounds: {
        Row: RoundRow;
        Insert: {
          id?: string;
          list_id?: string | null;
          status?: RoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          anonymous_appearance_total?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          list_id?: string | null;
          status?: RoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          anonymous_appearance_total?: number | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rounds_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'lists';
            referencedColumns: ['id'];
          },
        ];
      };
      round_appearances: {
        Row: RoundAppearanceRow;
        Insert: {
          id?: string;
          round_id: string;
          concept_id?: string | null;
          appearance_order: number;
          origin: RoundAppearanceOrigin;
          title_snapshot?: string | null;
          concept_deleted?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          concept_id?: string | null;
          appearance_order?: number;
          origin?: RoundAppearanceOrigin;
          title_snapshot?: string | null;
          concept_deleted?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'round_appearances_round_id_fkey';
            columns: ['round_id'];
            isOneToOne: false;
            referencedRelation: 'rounds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'round_appearances_concept_id_fkey';
            columns: ['concept_id'];
            isOneToOne: false;
            referencedRelation: 'concepts';
            referencedColumns: ['id'];
          },
        ];
      };
      round_operations: {
        Row: RoundOperationRow;
        Insert: {
          list_id: string;
          operation_id: string;
          round_id: string;
          action: RoundAction;
          outcome: RoundOperationOutcome;
          appearance_id?: string | null;
          concept_id?: string | null;
          result_state?: RoundResultState;
          created_at?: string;
        };
        Update: {
          list_id?: string;
          operation_id?: string;
          round_id?: string;
          action?: RoundAction;
          outcome?: RoundOperationOutcome;
          appearance_id?: string | null;
          concept_id?: string | null;
          result_state?: RoundResultState;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'round_operations_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'round_operations_round_id_fkey';
            columns: ['round_id'];
            isOneToOne: false;
            referencedRelation: 'rounds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'round_operations_appearance_id_fkey';
            columns: ['appearance_id'];
            isOneToOne: false;
            referencedRelation: 'round_appearances';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'round_operations_concept_id_fkey';
            columns: ['concept_id'];
            isOneToOne: false;
            referencedRelation: 'concepts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_or_create_current_round: {
        Args: { p_list_id: string };
        Returns: RoundRow;
      };
      mark_concept_seen: {
        Args: {
          p_list_id: string;
          p_concept_id: string;
          p_operation_id: string;
        };
        Returns: RoundOperationResult[];
      };
      draw_pending_concept: {
        Args: { p_list_id: string; p_operation_id: string };
        Returns: RoundOperationResult[];
      };
      return_concept_to_pending: {
        Args: {
          p_list_id: string;
          p_concept_id: string;
          p_operation_id: string;
        };
        Returns: RoundOperationResult[];
      };
      start_new_round: {
        Args: { p_list_id: string; p_operation_id: string };
        Returns: RoundOperationResult[];
      };
      ensure_profile: {
        Args: Record<string, never>;
        Returns: ProfileRow;
      };
      create_private_list: {
        Args: {
          p_name: string;
        };
        Returns: ListRow;
      };
      create_concept: {
        Args: {
          p_list_id: string;
          p_title: string;
          p_description?: string;
        };
        Returns: ConceptRow;
      };
      create_concepts_batch: {
        Args: {
          p_list_id: string;
          p_items: ConceptBatchItem[];
        };
        Returns: ConceptRow[];
      };
      update_concept: {
        Args: {
          p_concept_id: string;
          p_title: string;
          p_description: string;
          p_expected_updated_at: string;
        };
        Returns: ConceptRow;
      };
      delete_concept: {
        Args: {
          p_concept_id: string;
          p_expected_updated_at: string;
        };
        Returns: ConceptRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
