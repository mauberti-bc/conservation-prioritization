import { createContext, PropsWithChildren, useCallback, useEffect, useMemo } from 'react';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { TypedURLSearchParams, useSearchParams } from 'hooks/useSearchParams';

export type SidebarView = 'new' | 'tasks' | 'projects' | 'layers';

export interface ISidebarUIContext {
  activeView: SidebarView;
  setActiveView: (view: SidebarView) => void;
}

export const SidebarUIContext = createContext<ISidebarUIContext>({
  activeView: 'new',
  setActiveView: () => undefined,
});

/**
 * Provides sidebar view state backed by query params.
 */
export const SidebarUIContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const { searchParams, setSearchParams } = useSearchParams<HomeQueryParams>();
  const activeView = (searchParams.get(QUERY_PARAM.VIEW) as SidebarView) ?? 'new';

  useEffect(() => {
    if (!searchParams.get(QUERY_PARAM.VIEW)) {
      setSearchParams(searchParams.set(QUERY_PARAM.VIEW, 'new'));
    }
  }, [searchParams, setSearchParams]);

  const setActiveView = useCallback(
    (view: SidebarView) => {
      const nextParams = new TypedURLSearchParams<HomeQueryParams>(window.location.search);
      nextParams.setOrDelete(QUERY_PARAM.VIEW, view);
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
