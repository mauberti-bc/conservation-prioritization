import qs from 'qs';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * A hook that provides methods for reading and writing URL search params.
 *
 * @example
 * const { searchParams, setSearchParams } = useSearchParams<HomeQueryParams>();
 * searchParams.set(QUERY_PARAM.VIEW, 'tasks');
 * setSearchParams(searchParams);
 *
 * @example
 * type MyType = { [QUERY_PARAM.VIEW]?: 'tasks' }
 * const { searchParams, setSearchParams } = useSearchParams<MyType>();
 * const key1Value = searchParams.get(QUERY_PARAM.VIEW);
 * setSearchParams(searchParams.set(QUERY_PARAM.VIEW, 'tasks'));
 */
export function useSearchParams<ParamType extends Record<string, string> = Record<string, string>>() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new TypedURLSearchParams<ParamType>(location.search);

  const setSearchParams = (urlSearchParams: TypedURLSearchParams<ParamType>) => {
    navigate(
      {
        pathname: location.pathname,
        search: urlSearchParams.toString(),
      },
      { replace: true }
    );
  };

  return { searchParams, setSearchParams };
}

export class TypedURLSearchParams<
  ParamType extends Record<string, string> = Record<string, string>,
> extends URLSearchParams {
  set<K extends keyof ParamType & string>(key: K, value: ParamType[K]) {
    super.set(key, value);
    return this;
  }

  setOrDelete<K extends keyof ParamType & string>(key: K, value?: unknown) {
    if (value === null || value === undefined || value === '') {
      super.delete(key);
      return this;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      super.set(key, String(value));
      return this;
    }

    if (Array.isArray(value)) {
      super.set(key, qs.stringify(value, { allowEmptyArrays: false, arrayFormat: 'repeat' }));
      return this;
    }

    super.set(key, qs.stringify(value));
    return this;
  }

  get<K extends keyof ParamType & string>(key: K) {
    return super.get(key);
  }

  getArray<K extends keyof ParamType & string>(key: K): string[] {
    const value = super.get(key);
    if (!value) {
      return [];
    }
    return Object.values(qs.parse(value, { parseArrays: true, strictNullHandling: true }) as Record<string, string>);
  }

  delete<K extends keyof ParamType & string>(key: K) {
    super.delete(key);
    return this;
  }

  append<K extends keyof ParamType & string>(key: K, value: ParamType[K]) {
    super.append(key, value);
    return this;
  }

  entries<K extends keyof ParamType & string>() {
    return super.entries() as URLSearchParamsIterator<[string, ParamType[K]]>;
  }

  forEach<K extends keyof ParamType & string>(
    callback: (value: ParamType[K], key: K, searchParams: URLSearchParams) => void
  ) {
    super.forEach(callback as (value: string, key: string, searchParams: URLSearchParams) => void);
    return this;
  }

  getAll<K extends keyof ParamType & string>(key: K) {
    return super.getAll(key) as ParamType[K][];
  }

  has<K extends keyof ParamType & string>(key: K) {
    return super.has(key);
  }

  keys<K extends keyof ParamType & string>() {
    return super.keys() as URLSearchParamsIterator<K>;
  }

  sort() {
    super.sort();
    return this;
  }

  values<K extends keyof ParamType & string>() {
    return super.values() as URLSearchParamsIterator<ParamType[K]>;
  }
}
