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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
