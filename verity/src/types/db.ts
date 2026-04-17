export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      alert_rule: {
        Row: {
          categories: string[] | null
          created_at: string | null
          id: string
          jurisdictions: string[] | null
          keywords: string[] | null
          last_checked: string | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string | null
          id?: string
          jurisdictions?: string[] | null
          keywords?: string[] | null
          last_checked?: string | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string | null
          id?: string
          jurisdictions?: string[] | null
          keywords?: string[] | null
          last_checked?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          answer: string
          created_at: string | null
          id: number
          jurisdiction: string | null
          question: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: number
          jurisdiction?: string | null
          question: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: number
          jurisdiction?: string | null
          question?: string
        }
        Relationships: []
      }
      app_log: {
        Row: {
          created_at: string
          id: number
          level: string
          message: string
          meta: Json | null
        }
        Insert: {
          created_at?: string
          id?: never
          level: string
          message: string
          meta?: Json | null
        }
        Update: {
          created_at?: string
          id?: never
          level?: string
          message?: string
          meta?: Json | null
        }
        Relationships: []
      }
      ask_usage: {
        Row: {
          asked_at: string
          id: number
          user_id: string | null
        }
        Insert: {
          asked_at?: string
          id?: number
          user_id?: string | null
        }
        Update: {
          asked_at?: string
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      bill: {
        Row: {
          chamber: string | null
          external_id: string
          id: string
          introduced_on: string | null
          jurisdiction: string
          last_action_at: string | null
          status: string | null
          title: string
          url: string
        }
        Insert: {
          chamber?: string | null
          external_id: string
          id?: string
          introduced_on?: string | null
          jurisdiction: string
          last_action_at?: string | null
          status?: string | null
          title: string
          url: string
        }
        Update: {
          chamber?: string | null
          external_id?: string
          id?: string
          introduced_on?: string | null
          jurisdiction?: string
          last_action_at?: string | null
          status?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      bill_sources: {
        Row: {
          bill_id: string
          source_id: string
        }
        Insert: {
          bill_id: string
          source_id: string
        }
        Update: {
          bill_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_sources_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_sources_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_sources_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_trending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_sponsor: {
        Row: {
          bill_id: string
          created_at: string
          date_added: string | null
          id: string
          politician_id: string
          sponsor_type: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          date_added?: string | null
          id?: string
          politician_id: string
          sponsor_type: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          date_added?: string | null
          id?: string
          politician_id?: string
          sponsor_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_sponsor_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_sponsor_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_version: {
        Row: {
          bill_id: string | null
          content_md: string | null
          diff_from_prev: Json | null
          id: string
          published_at: string
          url: string
          version_no: number
        }
        Insert: {
          bill_id?: string | null
          content_md?: string | null
          diff_from_prev?: Json | null
          id?: string
          published_at: string
          url: string
          version_no: number
        }
        Update: {
          bill_id?: string | null
          content_md?: string | null
          diff_from_prev?: Json | null
          id?: string
          published_at?: string
          url?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_version_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_versions: {
        Row: {
          bill_id: string
          fetched_at: string | null
          id: string
          text_content: string | null
          version_label: string | null
        }
        Insert: {
          bill_id: string
          fetched_at?: string | null
          id?: string
          text_content?: string | null
          version_label?: string | null
        }
        Update: {
          bill_id?: string
          fetched_at?: string | null
          id?: string
          text_content?: string | null
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_versions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_versions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_versions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_trending"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          chamber: string | null
          current_version_id: string | null
          external_id: string | null
          full_text: string | null
          id: string
          introduced_at: string | null
          introduced_on: string | null
          jurisdiction: string | null
          last_movement_at: string | null
          short_title: string | null
          source: string
          source_url: string | null
          status: string | null
          summary: string | null
          title: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          chamber?: string | null
          current_version_id?: string | null
          external_id?: string | null
          full_text?: string | null
          id?: string
          introduced_at?: string | null
          introduced_on?: string | null
          jurisdiction?: string | null
          last_movement_at?: string | null
          short_title?: string | null
          source?: string
          source_url?: string | null
          status?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          chamber?: string | null
          current_version_id?: string | null
          external_id?: string | null
          full_text?: string | null
          id?: string
          introduced_at?: string | null
          introduced_on?: string | null
          jurisdiction?: string | null
          last_movement_at?: string | null
          short_title?: string | null
          source?: string
          source_url?: string | null
          status?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      case_entities: {
        Row: {
          case_id: string
          entity_id: string
          role: string | null
        }
        Insert: {
          case_id: string
          entity_id: string
          role?: string | null
        }
        Update: {
          case_id?: string
          entity_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_entities_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_entities_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities_view"
            referencedColumns: ["id"]
          },
        ]
      }
      case_signals: {
        Row: {
          case_id: string
          signal_id: string
        }
        Insert: {
          case_id: string
          signal_id: string
        }
        Update: {
          case_id?: string
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_signals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_signals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_signals_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_signals_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals_view"
            referencedColumns: ["id"]
          },
        ]
      }
      case_sources: {
        Row: {
          case_id: string
          source_id: string
        }
        Insert: {
          case_id: string
          source_id: string
        }
        Update: {
          case_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_sources_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_sources_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          id: string
          status: string
          title: string
          updated: string
        }
        Insert: {
          id?: string
          status?: string
          title: string
          updated?: string
        }
        Update: {
          id?: string
          status?: string
          title?: string
          updated?: string
        }
        Relationships: []
      }
      chunk: {
        Row: {
          content: string
          doc_id: string
          hash: string | null
          id: string
          idx: number
        }
        Insert: {
          content: string
          doc_id: string
          hash?: string | null
          id?: string
          idx: number
        }
        Update: {
          content?: string
          doc_id?: string
          hash?: string | null
          id?: string
          idx?: number
        }
        Relationships: [
          {
            foreignKeyName: "chunk_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          bill_id: string | null
          chunk_index: number
          content: string
          embedding: string | null
          id: number
        }
        Insert: {
          bill_id?: string | null
          chunk_index: number
          content: string
          embedding?: string | null
          id?: number
        }
        Update: {
          bill_id?: string | null
          chunk_index?: number
          content?: string
          embedding?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chunks_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_trending"
            referencedColumns: ["id"]
          },
        ]
      }
      citations: {
        Row: {
          answer_id: number
          chunk_id: number
          rank: number | null
        }
        Insert: {
          answer_id: number
          chunk_id: number
          rank?: number | null
        }
        Update: {
          answer_id?: number
          chunk_id?: number
          rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "citations_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_job: {
        Row: {
          attempt: number
          attempt_count: number
          created_at: string
          finished_at: string | null
          id: string
          jurisdiction: string
          last_error: string | null
          mirror_url: string | null
          name: string | null
          priority: number
          scheduled_for: string
          source_id: string
          started_at: string | null
          status: string
          type: string | null
          url: string
        }
        Insert: {
          attempt?: number
          attempt_count?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          jurisdiction: string
          last_error?: string | null
          mirror_url?: string | null
          name?: string | null
          priority?: number
          scheduled_for?: string
          source_id: string
          started_at?: string | null
          status?: string
          type?: string | null
          url: string
        }
        Update: {
          attempt?: number
          attempt_count?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          jurisdiction?: string
          last_error?: string | null
          mirror_url?: string | null
          name?: string | null
          priority?: number
          scheduled_for?: string
          source_id?: string
          started_at?: string | null
          status?: string
          type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_job_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_log: {
        Row: {
          bytes: number | null
          etag: string | null
          fetched_at: string
          hash: string | null
          http_status: number | null
          id: number
          ok: boolean | null
          source_id: string | null
        }
        Insert: {
          bytes?: number | null
          etag?: string | null
          fetched_at?: string
          hash?: string | null
          http_status?: number | null
          id?: number
          ok?: boolean | null
          source_id?: string | null
        }
        Update: {
          bytes?: number | null
          etag?: string | null
          fetched_at?: string
          hash?: string | null
          http_status?: number | null
          id?: number
          ok?: boolean | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source"
            referencedColumns: ["id"]
          },
        ]
      }
      document: {
        Row: {
          content: string
          created_at: string | null
          hash: string | null
          id: string
          jurisdiction: string
          published_at: string | null
          source_id: string | null
          title: string
          url: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          hash?: string | null
          id?: string
          jurisdiction: string
          published_at?: string | null
          source_id?: string | null
          title: string
          url?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          hash?: string | null
          id?: string
          jurisdiction?: string
          published_at?: string | null
          source_id?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_source_fk"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          id: number
          is_official: boolean | null
          jurisdiction: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_official?: boolean | null
          jurisdiction?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          is_official?: boolean | null
          jurisdiction?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      election: {
        Row: {
          created_at: string | null
          district: string | null
          election_date: string | null
          election_type: string | null
          id: string
          office: string | null
          results: Json | null
          slug: string
          state: string | null
          total_votes: number | null
          winner_politician_id: string | null
        }
        Insert: {
          created_at?: string | null
          district?: string | null
          election_date?: string | null
          election_type?: string | null
          id?: string
          office?: string | null
          results?: Json | null
          slug: string
          state?: string | null
          total_votes?: number | null
          winner_politician_id?: string | null
        }
        Update: {
          created_at?: string | null
          district?: string | null
          election_date?: string | null
          election_type?: string | null
          id?: string
          office?: string | null
          results?: Json | null
          slug?: string
          state?: string | null
          total_votes?: number | null
          winner_politician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "election_winner_politician_id_fkey"
            columns: ["winner_politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
        ]
      }
      electorates: {
        Row: {
          name: string
          state: string
        }
        Insert: {
          name: string
          state: string
        }
        Update: {
          name?: string
          state?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          created_at: string
          id: string
          jurisdiction: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          jurisdiction: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          jurisdiction?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      ingest_jobs: {
        Row: {
          id: string
          last_count: number | null
          last_finished_at: string | null
          last_message: string | null
          last_started_at: string | null
          last_status: string | null
        }
        Insert: {
          id: string
          last_count?: number | null
          last_finished_at?: string | null
          last_message?: string | null
          last_started_at?: string | null
          last_status?: string | null
        }
        Update: {
          id?: string
          last_count?: number | null
          last_finished_at?: string | null
          last_message?: string | null
          last_started_at?: string | null
          last_status?: string | null
        }
        Relationships: []
      }
      ingest_logs: {
        Row: {
          base_id: string
          created_at: string
          id: number
          is_official: boolean
          jurisdiction: string | null
          title: string
          total_chunks: number
          url: string | null
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: number
          is_official?: boolean
          jurisdiction?: string | null
          title: string
          total_chunks: number
          url?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: number
          is_official?: boolean
          jurisdiction?: string | null
          title?: string
          total_chunks?: number
          url?: string | null
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          count: number | null
          finished_at: string | null
          id: string
          job_id: string
          message: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          count?: number | null
          finished_at?: string | null
          id?: string
          job_id: string
          message?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          count?: number | null
          finished_at?: string | null
          id?: string
          job_id?: string
          message?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      mps: {
        Row: {
          electorate: string | null
          house: string | null
          id: string
          last_seen: string | null
          name: string
          party: string | null
          photo_url: string | null
          roles: Json | null
          slug: string | null
          state: string | null
          tvfy_person_id: number | null
          votes: Json | null
        }
        Insert: {
          electorate?: string | null
          house?: string | null
          id?: string
          last_seen?: string | null
          name: string
          party?: string | null
          photo_url?: string | null
          roles?: Json | null
          slug?: string | null
          state?: string | null
          tvfy_person_id?: number | null
          votes?: Json | null
        }
        Update: {
          electorate?: string | null
          house?: string | null
          id?: string
          last_seen?: string | null
          name?: string
          party?: string | null
          photo_url?: string | null
          roles?: Json | null
          slug?: string | null
          state?: string | null
          tvfy_person_id?: number | null
          votes?: Json | null
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          id: string
          published_at: string
          source: string | null
          title: string
          url: string | null
        }
        Insert: {
          id?: string
          published_at?: string
          source?: string | null
          title: string
          url?: string | null
        }
        Update: {
          id?: string
          published_at?: string
          source?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      news_item: {
        Row: {
          author: string | null
          bill_ids: Json | null
          created_at: string | null
          headline: string
          id: string
          politician_ids: Json | null
          published_at: string | null
          sentiment_score: number | null
          slug: string
          source: string | null
          summary: string | null
          tags: Json | null
          url: string
        }
        Insert: {
          author?: string | null
          bill_ids?: Json | null
          created_at?: string | null
          headline: string
          id?: string
          politician_ids?: Json | null
          published_at?: string | null
          sentiment_score?: number | null
          slug: string
          source?: string | null
          summary?: string | null
          tags?: Json | null
          url: string
        }
        Update: {
          author?: string | null
          bill_ids?: Json | null
          created_at?: string | null
          headline?: string
          id?: string
          politician_ids?: Json | null
          published_at?: string | null
          sentiment_score?: number | null
          slug?: string
          source?: string | null
          summary?: string | null
          tags?: Json | null
          url?: string
        }
        Relationships: []
      }
      politician: {
        Row: {
          chamber: string | null
          created_at: string
          electorate: string | null
          id: string
          name: string
          party: string | null
          slug: string | null
        }
        Insert: {
          chamber?: string | null
          created_at?: string
          electorate?: string | null
          id?: string
          name: string
          party?: string | null
          slug?: string | null
        }
        Update: {
          chamber?: string | null
          created_at?: string
          electorate?: string | null
          id?: string
          name?: string
          party?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      politicians: {
        Row: {
          biography: string | null
          bioguide_id: string | null
          chamber: string | null
          committee_memberships: Json | null
          created_at: string | null
          date_of_birth: string | null
          district: string | null
          education: string | null
          govtrack_id: string | null
          id: string
          leadership_positions: Json | null
          name: string
          occupation: string | null
          office_address: string | null
          official_website: string | null
          opensecrets_id: string | null
          party: string | null
          phone: string | null
          search_vector: unknown | null
          state: string | null
          terms_served: number | null
          thomas_id: string | null
          twitter_handle: string | null
          updated_at: string | null
        }
        Insert: {
          biography?: string | null
          bioguide_id?: string | null
          chamber?: string | null
          committee_memberships?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          district?: string | null
          education?: string | null
          govtrack_id?: string | null
          id?: string
          leadership_positions?: Json | null
          name: string
          occupation?: string | null
          office_address?: string | null
          official_website?: string | null
          opensecrets_id?: string | null
          party?: string | null
          phone?: string | null
          search_vector?: unknown | null
          state?: string | null
          terms_served?: number | null
          thomas_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Update: {
          biography?: string | null
          bioguide_id?: string | null
          chamber?: string | null
          committee_memberships?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          district?: string | null
          education?: string | null
          govtrack_id?: string | null
          id?: string
          leadership_positions?: Json | null
          name?: string
          occupation?: string | null
          office_address?: string | null
          official_website?: string | null
          opensecrets_id?: string | null
          party?: string | null
          phone?: string | null
          search_vector?: unknown | null
          state?: string | null
          terms_served?: number | null
          thomas_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      poll: {
        Row: {
          bill_id: string | null
          created_at: string | null
          field_dates: unknown | null
          id: string
          issue_area: string | null
          margin_of_error: number | null
          methodology: string | null
          politician_id: string | null
          pollster: string | null
          published_date: string | null
          question: string
          results: Json | null
          sample_size: number | null
          slug: string
        }
        Insert: {
          bill_id?: string | null
          created_at?: string | null
          field_dates?: unknown | null
          id?: string
          issue_area?: string | null
          margin_of_error?: number | null
          methodology?: string | null
          politician_id?: string | null
          pollster?: string | null
          published_date?: string | null
          question: string
          results?: Json | null
          sample_size?: number | null
          slug: string
        }
        Update: {
          bill_id?: string | null
          created_at?: string | null
          field_dates?: unknown | null
          id?: string
          issue_area?: string | null
          margin_of_error?: number | null
          methodology?: string | null
          politician_id?: string | null
          pollster?: string | null
          published_date?: string | null
          question?: string
          results?: Json | null
          sample_size?: number | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_vote: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          poll_id: string
          predicted_result: Json | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          poll_id: string
          predicted_result?: Json | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          poll_id?: string
          predicted_result?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_vote_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_vote_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          device_id: string
          postcode: string | null
          topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          postcode?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          postcode?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promise: {
        Row: {
          created_at: string | null
          id: string
          made_date: string | null
          politician_id: string
          progress_notes: string | null
          promise_text: string
          promise_type: string | null
          related_bill_id: string | null
          slug: string
          source_url: string | null
          status: string | null
          target_date: string | null
          verification_urls: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          made_date?: string | null
          politician_id: string
          progress_notes?: string | null
          promise_text: string
          promise_type?: string | null
          related_bill_id?: string | null
          slug: string
          source_url?: string | null
          status?: string | null
          target_date?: string | null
          verification_urls?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          made_date?: string | null
          politician_id?: string
          progress_notes?: string | null
          promise_text?: string
          promise_type?: string | null
          related_bill_id?: string | null
          slug?: string
          source_url?: string | null
          status?: string | null
          target_date?: string | null
          verification_urls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "promise_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promise_related_bill_id_fkey"
            columns: ["related_bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_logs: {
        Row: {
          answer: string
          created_at: string
          day_utc: string | null
          id: string
          jurisdiction: string | null
          latency_ms: number | null
          question: string
          sources: string[]
          thumbs_down: boolean | null
          thumbs_up: boolean | null
        }
        Insert: {
          answer: string
          created_at?: string
          day_utc?: string | null
          id?: string
          jurisdiction?: string | null
          latency_ms?: number | null
          question: string
          sources: string[]
          thumbs_down?: boolean | null
          thumbs_up?: boolean | null
        }
        Update: {
          answer?: string
          created_at?: string
          day_utc?: string | null
          id?: string
          jurisdiction?: string | null
          latency_ms?: number | null
          question?: string
          sources?: string[]
          thumbs_down?: boolean | null
          thumbs_up?: boolean | null
        }
        Relationships: []
      }
      rating: {
        Row: {
          created_at: string | null
          description: string | null
          fiscal: number | null
          grade: string | null
          id: string
          issue_area: string | null
          methodology_url: string | null
          organization: string
          politician_id: string
          rating_period: string | null
          score: number | null
          social_impact: number | null
          transparency: number | null
          trust: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          fiscal?: number | null
          grade?: string | null
          id?: string
          issue_area?: string | null
          methodology_url?: string | null
          organization: string
          politician_id: string
          rating_period?: string | null
          score?: number | null
          social_impact?: number | null
          transparency?: number | null
          trust?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          fiscal?: number | null
          grade?: string | null
          id?: string
          issue_area?: string | null
          methodology_url?: string | null
          organization?: string
          politician_id?: string
          rating_period?: string | null
          score?: number | null
          social_impact?: number | null
          transparency?: number | null
          trust?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          bill_id: string | null
          confidence_score: number | null
          created_at: string | null
          id: string
          importance_score: number | null
          issue_tags: Json | null
          notes: string | null
          politician_id: string | null
          position: string | null
          rating_type: string
          roll_call_number: number | null
          source: string | null
          source_url: string | null
          updated_at: string | null
          vote_date: string | null
          vote_type: string | null
        }
        Insert: {
          bill_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          importance_score?: number | null
          issue_tags?: Json | null
          notes?: string | null
          politician_id?: string | null
          position?: string | null
          rating_type: string
          roll_call_number?: number | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
          vote_date?: string | null
          vote_type?: string | null
        }
        Update: {
          bill_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          importance_score?: number | null
          issue_tags?: Json | null
          notes?: string | null
          politician_id?: string | null
          position?: string | null
          rating_type?: string
          roll_call_number?: number | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
          vote_date?: string | null
          vote_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_trending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politicians"
            referencedColumns: ["id"]
          },
        ]
      }
      sentiment_snapshot: {
        Row: {
          bill_id: string | null
          confidence_score: number | null
          created_at: string | null
          id: number
          issue_area: string | null
          period_end: string | null
          period_start: string | null
          politician_id: string | null
          sentiment_score: number | null
          snapshot_date: string | null
          sources: Json | null
          volume_score: number | null
        }
        Insert: {
          bill_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          issue_area?: string | null
          period_end?: string | null
          period_start?: string | null
          politician_id?: string | null
          sentiment_score?: number | null
          snapshot_date?: string | null
          sources?: Json | null
          volume_score?: number | null
        }
        Update: {
          bill_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          issue_area?: string | null
          period_end?: string | null
          period_start?: string | null
          politician_id?: string | null
          sentiment_score?: number | null
          snapshot_date?: string | null
          sources?: Json | null
          volume_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_snapshot_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentiment_snapshot_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_sources: {
        Row: {
          signal_id: string
          source_id: string
        }
        Insert: {
          signal_id: string
          source_id: string
        }
        Update: {
          signal_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_sources_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_sources_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          created_at: string
          id: string
          jurisdiction: string
          reason: string
          score: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          jurisdiction: string
          reason: string
          score: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          jurisdiction?: string
          reason?: string
          score?: number
          title?: string
        }
        Relationships: []
      }
      source: {
        Row: {
          active: boolean | null
          crawl_interval_minutes: number
          created_at: string
          id: string
          jurisdiction: string
          last_crawled_at: string | null
          last_error: string | null
          name: string
          status: string
          type: string
          url: string
        }
        Insert: {
          active?: boolean | null
          crawl_interval_minutes?: number
          created_at?: string
          id?: string
          jurisdiction: string
          last_crawled_at?: string | null
          last_error?: string | null
          name: string
          status?: string
          type?: string
          url: string
        }
        Update: {
          active?: boolean | null
          crawl_interval_minutes?: number
          created_at?: string
          id?: string
          jurisdiction?: string
          last_crawled_at?: string | null
          last_error?: string | null
          name?: string
          status?: string
          type?: string
          url?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          id: string
          kind: string
          published_at: string | null
          url: string
        }
        Insert: {
          id?: string
          kind: string
          published_at?: string | null
          url: string
        }
        Update: {
          id?: string
          kind?: string
          published_at?: string | null
          url?: string
        }
        Relationships: []
      }
      stance: {
        Row: {
          actual_vote: string | null
          bill_id: string
          confidence_score: number | null
          created_at: string | null
          id: string
          importance_score: number | null
          notes: string | null
          politician_id: string
          position: string
          roll_call_number: number | null
          source: string
          source_url: string | null
          updated_at: string | null
          vote_date: string | null
          vote_type: string | null
        }
        Insert: {
          actual_vote?: string | null
          bill_id: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          importance_score?: number | null
          notes?: string | null
          politician_id: string
          position: string
          roll_call_number?: number | null
          source: string
          source_url?: string | null
          updated_at?: string | null
          vote_date?: string | null
          vote_type?: string | null
        }
        Update: {
          actual_vote?: string | null
          bill_id?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          importance_score?: number | null
          notes?: string | null
          politician_id?: string
          position?: string
          roll_call_number?: number | null
          source?: string
          source_url?: string | null
          updated_at?: string | null
          vote_date?: string | null
          vote_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stance_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stance_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
        ]
      }
      statement: {
        Row: {
          bill_id: string | null
          content: string
          created_at: string | null
          id: string
          issue_tags: Json | null
          issued_date: string | null
          politician_id: string
          sentiment_score: number | null
          slug: string
          source_url: string | null
          statement_type: string | null
          title: string | null
        }
        Insert: {
          bill_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          issue_tags?: Json | null
          issued_date?: string | null
          politician_id: string
          sentiment_score?: number | null
          slug: string
          source_url?: string | null
          statement_type?: string | null
          title?: string | null
        }
        Update: {
          bill_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          issue_tags?: Json | null
          issued_date?: string | null
          politician_id?: string
          sentiment_score?: number | null
          slug?: string
          source_url?: string | null
          statement_type?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statement_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "politician"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          revenuecat_app_user_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          revenuecat_app_user_id?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          revenuecat_app_user_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          jurisdiction: string
          status: string
          text: string
          url: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          jurisdiction: string
          status?: string
          text: string
          url?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string
          status?: string
          text?: string
          url?: string | null
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          electorate: string | null
          email_opt_in: boolean | null
          id: string
          interests: string[] | null
          jurisdiction: string | null
          parties: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          electorate?: string | null
          email_opt_in?: boolean | null
          id: string
          interests?: string[] | null
          jurisdiction?: string | null
          parties?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          electorate?: string | null
          email_opt_in?: boolean | null
          id?: string
          interests?: string[] | null
          jurisdiction?: string | null
          parties?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          last_question_at: string | null
          questions_asked: number | null
          stripe_customer_id: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          last_question_at?: string | null
          questions_asked?: number | null
          stripe_customer_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_question_at?: string | null
          questions_asked?: number | null
          stripe_customer_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      watch_bill: {
        Row: {
          bill_id: string
          created_at: string | null
          id: string
          notes: string | null
          notify_on_action: boolean | null
          notify_on_vote: boolean | null
          user_id: string
        }
        Insert: {
          bill_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          notify_on_action?: boolean | null
          notify_on_vote?: boolean | null
          user_id: string
        }
        Update: {
          bill_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          notify_on_action?: boolean | null
          notify_on_vote?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_bill_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_bill_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_document: {
        Row: {
          created_at: string | null
          doc_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          doc_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          doc_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bill_search: {
        Row: {
          external_id: string | null
          id: string | null
          introduced_on: string | null
          source: string | null
          status: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          external_id?: string | null
          id?: string | null
          introduced_on?: string | null
          source?: string | null
          status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          external_id?: string | null
          id?: string | null
          introduced_on?: string | null
          source?: string | null
          status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      cases_view: {
        Row: {
          id: string | null
          signal_count: number | null
          status: string | null
          title: string | null
          updated: string | null
        }
        Relationships: []
      }
      entities_view: {
        Row: {
          caseCount: number | null
          created_at: string | null
          id: string | null
          jurisdiction: string | null
          name: string | null
          type: string | null
        }
        Relationships: []
      }
      mps_facets: {
        Row: {
          cnt: number | null
          facet: string | null
          value: string | null
        }
        Relationships: []
      }
      qa_daily: {
        Row: {
          day: string | null
          down: number | null
          total: number | null
          up: number | null
        }
        Relationships: []
      }
      signals_view: {
        Row: {
          created_at: string | null
          id: string | null
          jurisdiction: string | null
          reason: string | null
          score: number | null
          source_ids: string[] | null
          title: string | null
        }
        Relationships: []
      }
      v_trending: {
        Row: {
          chamber: string | null
          id: string | null
          last_movement_at: string | null
          source_url: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      v_user_subscription: {
        Row: {
          auth_user_id: string | null
          current_period_end: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _apply_civic_policies: {
        Args: { tbl: unknown }
        Returns: undefined
      }
      _apply_user_owned_policies_detect: {
        Args: { allow_writes?: boolean; preferred?: string; tbl: unknown }
        Returns: undefined
      }
      _detect_user_col: {
        Args: { preferred?: string; tbl: unknown }
        Returns: string
      }
      _has_column: {
        Args: { col: string; tbl: unknown }
        Returns: boolean
      }
      _infer_state: {
        Args: { _electorate: string; _house: string }
        Returns: string
      }
      _last_token: {
        Args: { txt: string }
        Returns: string
      }
      _mps_q_match: {
        Args: { _electorate: string; _name: string; _party: string; q: string }
        Returns: boolean
      }
      _ping: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      claim_crawl_job: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          source_id: string
          url: string
        }[]
      }
      create_crawl_job: {
        Args:
          | {
              p_jurisdiction: string
              p_name: string
              p_type: string
              p_url: string
            }
          | { p_jurisdiction: string; p_name: string; p_url: string }
          | { p_jurisdiction: string; p_name: string; p_url: string }
          | {
              p_jurisdiction?: string
              p_name: string
              p_type?: string
              p_url: string
            }
          | { p_name: string; p_url: string }
          | { p_name: string; p_url: string }
        Returns: string
      }
      follow_bill: {
        Args: { p_bill_id: string; p_user_id: string }
        Returns: undefined
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      inc_attempt: {
        Args: { jid: string }
        Returns: number
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      mp_by_slug: {
        Args: { p_slug: string }
        Returns: {
          electorate: string | null
          house: string | null
          id: string
          last_seen: string | null
          name: string
          party: string | null
          photo_url: string | null
          roles: Json | null
          slug: string | null
          state: string | null
          tvfy_person_id: number | null
          votes: Json | null
        }
      }
      mp_page: {
        Args: { p_slug: string }
        Returns: Json
      }
      mp_related_bills: {
        Args: { p_limit?: number; p_slug: string }
        Returns: {
          chamber: string | null
          current_version_id: string | null
          external_id: string | null
          full_text: string | null
          id: string
          introduced_at: string | null
          introduced_on: string | null
          jurisdiction: string | null
          last_movement_at: string | null
          short_title: string | null
          source: string
          source_url: string | null
          status: string | null
          summary: string | null
          title: string
          updated_at: string | null
          url: string | null
        }[]
      }
      mp_related_news: {
        Args: { p_limit?: number; p_slug: string }
        Returns: {
          id: string
          published_at: string
          source: string | null
          title: string
          url: string | null
        }[]
      }
      mps_filter: {
        Args: {
          houses?: string[]
          lim?: number
          off?: number
          parties?: string[]
          q?: string
          states?: string[]
        }
        Returns: {
          electorate: string | null
          house: string | null
          id: string
          last_seen: string | null
          name: string
          party: string | null
          photo_url: string | null
          roles: Json | null
          slug: string | null
          state: string | null
          tvfy_person_id: number | null
          votes: Json | null
        }[]
      }
      mps_filter_bundle: {
        Args: {
          houses?: string[]
          lim?: number
          off?: number
          parties?: string[]
          q?: string
          states?: string[]
        }
        Returns: {
          items: Json
          total: number
        }[]
      }
      mps_filter_count: {
        Args: {
          houses?: string[]
          parties?: string[]
          q?: string
          states?: string[]
        }
        Returns: number
      }
      mps_filter_total: {
        Args: {
          houses?: string[]
          parties?: string[]
          q?: string
          states?: string[]
        }
        Returns: number
      }
      mps_houses: {
        Args: Record<PropertyKey, never>
        Returns: {
          house: string
          n: number
        }[]
      }
      mps_parties: {
        Args: Record<PropertyKey, never>
        Returns: {
          n: number
          party: string
        }[]
      }
      mps_search: {
        Args: { lim?: number; off?: number; q: string }
        Returns: {
          electorate: string | null
          house: string | null
          id: string
          last_seen: string | null
          name: string
          party: string | null
          photo_url: string | null
          roles: Json | null
          slug: string | null
          state: string | null
          tvfy_person_id: number | null
          votes: Json | null
        }[]
      }
      mps_states: {
        Args: Record<PropertyKey, never>
        Returns: {
          n: number
          state: string
        }[]
      }
      politician_report_card: {
        Args: { p_politician_id: string }
        Returns: {
          avg_fiscal: number
          avg_social_impact: number
          avg_transparency: number
          avg_trust: number
          ratings_count: number
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      unfollow_bill: {
        Args: { p_bill_id: string; p_user_id: string }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
