import { mdiCogOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import { grey } from '@mui/material/colors';
import { ControlPanelAdvancedForm } from './form/ControlPanelAdvancedForm';

interface ControlPanelAdvanced {
  open: boolean;
  handleClick: () => void;
}

export const ControlPanelAdvanced = (props: ControlPanelAdvanced) => {
  const { open, handleClick } = props;

  return (
    <Box flex="1 1 auto" width="100%">
      <Box>
        <Button
          onClick={handleClick}
          startIcon={<Icon path={mdiCogOutline} size={1} />}
          sx={{ color: grey[500], justifyContent: 'flex-start' }}>
          {open ? 'Hide Advanced' : 'Show Advanced'}
        </Button>
      </Box>
      <Collapse in={open} sx={{ width: '100%' }}>
        <Box ml={1} my={1}>
          <ControlPanelAdvancedForm />
        </Box>
      </Collapse>
    </Box>
  );
};
