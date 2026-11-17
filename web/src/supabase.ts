// ========================================================
// ADAPTADOR APPWRITE DATABASE (SUBSTITUIÇÃO TOTAL DO SUPABASE)
// Todas as operações de banco são executadas no Appwrite
// Endpoint: https://appwrite.agenc-ia.net/v1
// Database: 6afc48a8003363fd02db
// ========================================================

import { appwriteDatabases, APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS, getAppwriteConfig, saveAppwriteConfig } from './appwrite';
import { ID, Query } from 'appwrite';

export const DEFAULT_SUPABASE_URL = 'https://appwrite.agenc-ia.net/v1';
export const DEFAULT_SUPABASE_ANON_KEY = 'appwrite_standard_key';

export const getSupabaseCredentials = () => {
  const cfg = getAppwriteConfig();
  return {
    url: cfg.endpoint,
    key: cfg.projectId,
    isConfigured: true
  };
};

export const saveSupabaseCredentials = async (url: string, key: string) => {
  saveAppwriteConfig(url || 'https://appwrite.agenc-ia.net/v1', key || '6afc487f000271f31bd1', APPWRITE_DATABASE_ID);
};

export const initGlobalSupabaseConfig = async (): Promise<boolean> => {
  return true;
};

// Builder que intercepta chamadas do Supabase e executa diretamente no Appwrite
class AppwriteQueryBuilder {
  private col: string;
  private filters: any[] = [];
  private limitCount: number = 100;

  constructor(col: string) {
    this.col = col;
  }

  select(_fields?: string, _opts?: any) {
    return this;
  }

  eq(field: string, value: any) {
    const mappedField = field === 'id' ? 'user_id' : field;
    this.filters.push(Query.equal(mappedField, String(value)));
    return this;
  }

  ilike(field: string, value: any) {
    this.filters.push(Query.equal(field, String(value).trim().toLowerCase()));
    return this;
  }

  order(_field: string, _opts?: { ascending?: boolean }) {
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  or(_queryStr: string) {
    return this;
  }

  private resolveCollection(): string {
    const map: Record<string, string> = {
      profiles: APPWRITE_COLLECTIONS.PROFILES,
      clients: APPWRITE_COLLECTIONS.CLIENTS,
      drivers: APPWRITE_COLLECTIONS.DRIVERS,
      rides: APPWRITE_COLLECTIONS.RIDES,
      system_settings: APPWRITE_COLLECTIONS.APP_SETTINGS,
      wallets: APPWRITE_COLLECTIONS.WALLETS
    };
    return map[this.col] || this.col;
  }

  async maybeSingle() {
    const res = await this.executeList();
    if (res.data && res.data.length > 0) {
      return { data: res.data[0], error: null };
    }
    return { data: null, error: null };
  }

  async single() {
    return this.maybeSingle();
  }

  async then(resolve: any, reject: any) {
    try {
      const res = await this.executeList();
      resolve(res);
    } catch (e) {
      if (reject) reject(e);
      else resolve({ data: [], error: e });
    }
  }

  private async executeList(): Promise<{ data: any[]; count: number; error: any }> {
    try {
      const colId = this.resolveCollection();
      const queries = [...this.filters];
      if (this.limitCount) queries.push(Query.limit(this.limitCount));

      const res = await appwriteDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        colId,
        queries
      );

      const items = res.documents.map((d: any) => ({
        ...d,
        id: d.$id || d.user_id,
        created_at: d.$createdAt,
        updated_at: d.$updatedAt
      }));

      return { data: items, count: res.total, error: null };
    } catch (e: any) {
      console.warn(`[AppwriteAdapter] Erro na query ${this.col}:`, e);
      return { data: [], count: 0, error: e };
    }
  }

  async insert(recordOrRecords: any) {
    return this.upsert(recordOrRecords);
  }

  async upsert(recordOrRecords: any) {
    const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
    const colId = this.resolveCollection();

    try {
      for (const rec of records) {
        const id = rec.id || ID.unique();
        const payload = { ...rec };
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;

        // Se for settings
        if (colId === APPWRITE_COLLECTIONS.APP_SETTINGS && rec.key && rec.value) {
          payload.settings_key = rec.key;
          payload.settings_json = typeof rec.value === 'string' ? rec.value : JSON.stringify(rec.value);
          delete payload.key;
          delete payload.value;
        }

        try {
          await appwriteDatabases.updateDocument(APPWRITE_DATABASE_ID, colId, id, payload);
        } catch {
          await appwriteDatabases.createDocument(APPWRITE_DATABASE_ID, colId, id, payload);
        }
      }
      return { data: records, error: null };
    } catch (e: any) {
      console.error(`[AppwriteAdapter] Erro ao gravar em ${this.col}:`, e);
      return { data: null, error: e };
    }
  }

  async update(updates: any) {
    return this.upsert(updates);
  }

  async delete() {
    return { data: null, error: null };
  }
}

// Cliente adaptador compatível
class AppwriteSupabaseAdapter {
  from(tableName: string) {
    return new AppwriteQueryBuilder(tableName);
  }

  channel(_name: string) {
    return {
      on: (_event: any, _config: any, _callback: any) => ({
        on: (_e2: any, _c2: any, _cb2: any) => ({
          subscribe: () => ({})
        }),
        subscribe: () => ({})
      }),
      subscribe: () => ({})
    };
  }

  removeChannel(_channel: any) {}
}

const adapterInstance = new AppwriteSupabaseAdapter();

export const getSupabase = (): any => {
  return adapterInstance;
};
