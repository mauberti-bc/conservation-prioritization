import { createContext, PropsWithChildren, useCallback, useMemo } from 'react';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { TypedURLSearchParams, useSearchParams } from 'hooks/useSearchParams';

export type SidebarView = 'tasks' | 'projects' | 'layers';

export interface ISidebarUIContext {
  activeView: SidebarView | null;
  setActiveView: (view: SidebarView | null) => void;
}

export const SidebarUIContext = createContext<ISidebarUIContext>({
  activeView: null,
  setActiveView: () => undefined,
});

/**
 * Provides sidebar view state backed by query params.
 */
export const SidebarUIContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const { searchParams, setSearchParams } = useSearchParams<HomeQueryParams>();
  const activeView = (searchParams.get(QUERY_PARAM.VIEW) as SidebarView) ?? null;

  const setActiveView = useCallback(
    (view: SidebarView | null) => {
      const nextParams = new TypedURLSearchParams<HomeQueryParams>(window.location.search);
      nextParams.setOrDelete(QUERY_PARAM.VIEW, view ?? undefined);
      setSearchParams(nextParams);
    },
    [setSearchParams]
  );

  const contextValue = useMemo(() => {
    return {
      activeView,
      setActiveView,
    };
  }, [activeView, setActiveView]);

  return <SidebarUIContext.Provider value={contextValue}>{props.children}</SidebarUIContext.Provider>;
};
