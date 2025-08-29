import { useConfigContext } from 'hooks/useContext';
import { useZarr } from 'hooks/useZarr';
import { useEffect, useMemo, useState } from 'react';
import { LayerOption } from '../control-panel/form/ControlPanelForm';
import { LayerPanelTextField } from '../layer-panel/search/LayerPanelTextField';

interface SearchZarrProps {
  onChange?: (filtered: LayerOption[]) => void;
  children?: (layerOptions: LayerOption[]) => React.ReactNode;
  showSearchInput?: boolean;
}

export const SearchZarr = ({ onChange, children, showSearchInput = true }: SearchZarrProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { ZARR_STORE_PATH } = useConfigContext();
  const zarr = useZarr(ZARR_STORE_PATH);

  const allLayers: LayerOption[] = useMemo(() => {
    return zarr.variables.map((variable) => ({
      name: variable.name,
      path: variable.path,
      description: variable.description,
      group: variable.group,
    }));
  }, [zarr]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 100);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return allLayers;
    }
    return allLayers.filter((layer) => layer.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [debouncedSearch, allLayers]);

  useEffect(() => {
    if (onChange) {
      onChange(filtered);
    }
  }, [filtered, onChange]);

  return (
    <>
      {showSearchInput && (
        <LayerPanelTextField value={searchInput} handleChange={(e) => setSearchInput(e.target.value)} />
      )}
      {children && children(filtered)}
    </>
  );
};
