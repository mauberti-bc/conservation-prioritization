import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { debounce, InputAdornment, TextField, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import { useEffect, useMemo, useState } from 'react';

interface SidebarSectionProps {
  title: string;
  onSearch: (term: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  showSearch?: boolean;
  action?: React.ReactNode;
}

/**
 * Shared sidebar section with a title, search input, and content area.
 *
 * @param {SidebarSectionProps} props
 * @returns {JSX.Element}
 */
export const SidebarSection = ({
  title,
  onSearch,
  children,
  placeholder,
  showSearch = true,
  action,
}: SidebarSectionProps) => {
  const [value, setValue] = useState('');

  const debouncedSearch = useMemo(() => {
    return debounce((term: string) => {
      onSearch(term);
    }, 300);
  }, [onSearch]);

  useEffect(() => {
    return () => {
      debouncedSearch.clear();
    };
  }, [debouncedSearch]);

  return (
    <Box display="flex" flexDirection="column" gap={2} px={3} py={2} height="100%">
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} py={1}>
        <Typography variant="h3">{title}</Typography>
        {action}
      </Box>
      {showSearch && (
        <TextField
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValue(nextValue);
            debouncedSearch(nextValue);
          }}
          variant="outlined"
          fullWidth
          placeholder={placeholder ?? 'Search'}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Icon path={mdiMagnify} size={1} style={{ color: grey[500] }} />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      <Box display="flex" flexDirection="column" gap={2} flex={1} minHeight={0}>
        {children}
      </Box>
    </Box>
  );
};
