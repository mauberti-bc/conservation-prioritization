import { mdiChevronDown, mdiCogOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import { grey } from '@mui/material/colors';
import { useState } from 'react';
import { TaskAdvancedForm } from './form/TaskAdvancedForm';

export const TaskAdvancedSection = () => {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen((prev) => !prev);
  };

  return (
    <Box width="100%">
      <Box>
        <Button
          onClick={handleClick}
          color="primary"
          startIcon={<Icon path={mdiCogOutline} size={1} />}
          endIcon={
            <Icon
              path={mdiChevronDown}
              size={1}
              style={{
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          }
          sx={{ justifyContent: 'flex-start', color: grey[500] }}>
          {open ? 'Hide Advanced' : 'Show Advanced'}
        </Button>
      </Box>

      <Collapse in={open} sx={{ width: '100%' }} timeout={100}>
        <Box ml={1} my={1}>
          <TaskAdvancedForm />
        </Box>
      </Collapse>
    </Box>
  );
};
