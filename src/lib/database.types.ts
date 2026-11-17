export type Locale = 'es' | 'en';

export type ProfileRow = {
  id: string;
  locale: Locale | null;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          locale?: Locale | null;
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
    };
    Views: Record<string, never>;
    Functions: {
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
