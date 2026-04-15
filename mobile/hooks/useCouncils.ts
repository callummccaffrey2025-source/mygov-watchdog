import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Council {
  id: string;
  name: string;
  state: string;
  type: 'city' | 'shire' | 'regional';
  website: string | null;
  mayor_name: string | null;
  area_postcodes: string[] | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  population: number | null;
  area_sqkm: number | null;
}

export function useCouncils() {
  const [councils, setCouncils] = useState<Council[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('councils')
      .select('id,name,state,type,website,mayor_name,area_postcodes,phone,email,address,population,area_sqkm')
      .order('state')
      .order('name')
      .then(({ data }) => {
        setCouncils((data as Council[]) || []);
        setLoading(false);
      });
  }, []);

  return { councils, loading };
}
