"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

interface FranqueadoraOption {
  id: string;
  nome: string;
}

interface FranqueadoraContextValue {
  activeFranqueadoraId: string;
  setActiveFranqueadoraId: (id: string) => void;
  franqueadoras: FranqueadoraOption[];
  isGroupUser: boolean;
  loading: boolean;
}

const FranqueadoraContext = createContext<FranqueadoraContextValue>({
  activeFranqueadoraId: "all",
  setActiveFranqueadoraId: () => {},
  franqueadoras: [],
  isGroupUser: false,
  loading: true,
});

export function useFranqueadora() {
  return useContext(FranqueadoraContext);
}

const STORAGE_KEY = "active_franqueadora_id";

export function FranqueadoraProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [franqueadoras, setFranqueadoras] = useState<FranqueadoraOption[]>([]);
  const [activeFranqueadoraId, setActiveId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const isGroupUser = !!session?.user?.grupoFranqueadoraId;

  useEffect(() => {
    if (!isGroupUser) {
      setLoading(false);
      return;
    }

    fetch("/api/grupo/franqueadoras")
      .then((r) => r.json())
      .then((data) => {
        setFranqueadoras(data.franqueadoras ?? []);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (
          stored &&
          (stored === "all" ||
            data.franqueadoras?.some(
              (f: FranqueadoraOption) => f.id === stored
            ))
        ) {
          setActiveId(stored);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isGroupUser]);

  const setActiveFranqueadoraId = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const value = useMemo(
    () => ({
      activeFranqueadoraId,
      setActiveFranqueadoraId,
      franqueadoras,
      isGroupUser,
      loading,
    }),
    [activeFranqueadoraId, setActiveFranqueadoraId, franqueadoras, isGroupUser, loading]
  );

  return (
    <FranqueadoraContext.Provider value={value}>
      {children}
    </FranqueadoraContext.Provider>
  );
}
