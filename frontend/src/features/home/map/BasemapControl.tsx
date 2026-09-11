import { mdiLayers } from '@mdi/js';
import Icon from '@mdi/react';
import { FormControlLabel, IconButton, Popover, Radio, RadioGroup, Tooltip } from '@mui/material';
import { BASEMAP } from 'constants/basemap';
import { useId, useState } from 'react';
import { BasemapControlProps } from './BasemapControl.interface';

/**
 * Opens the map's basemap choices from a compact layers button.
 *
 * @param {BasemapControlProps} props Component properties.
 * @returns {React.ReactNode} The rendered component.
 */
export const BasemapControl = ({ value, onChange, right }: BasemapControlProps) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();

  return (
    <>
      <Tooltip title="Map layers">
        <IconButton
          aria-label="Map layers"
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? menuId : undefined}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            position: 'absolute',
            top: 10,
            right,
            width: 48,
            height: 48,
            bgcolor: 'background.paper',
            color: 'grey.600',
            borderRadius: 1,
            boxShadow: 3,
            '&:hover': { bgcolor: 'grey.100' },
          }}>
          <Icon path={mdiLayers} size={1.4} />
        </IconButton>
      </Tooltip>
      <Popover
        id={menuId}
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, px: 2, py: 1, borderRadius: 1 } } }}>
        <RadioGroup
          aria-label="Basemap"
          value={value}
          onChange={(_event, selection) => {
            onChange(selection as BASEMAP);
            setAnchor(null);
          }}>
          <FormControlLabel value={BASEMAP.SATELLITE} control={<Radio />} label="World Imagery" />
          <FormControlLabel value={BASEMAP.BC_GOV} control={<Radio />} label="BC Government Map" />
        </RadioGroup>
      </Popover>
    </>
  );
};
