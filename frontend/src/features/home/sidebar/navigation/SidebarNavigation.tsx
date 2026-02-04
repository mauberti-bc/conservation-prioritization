import { mdiClipboardClockOutline, mdiFolderOutline, mdiLayersTripleOutline, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Tab, Tabs } from '@mui/material';
import { SidebarView } from 'context/sidebarUIContext';
import React from 'react';

interface SidebarNavigationProps {
  activeView: SidebarView;
  onViewChange: (newView: SidebarView) => void;
}

export const SidebarNavigation = ({ activeView, onViewChange }: SidebarNavigationProps) => {
  const handleChange = (_event: React.SyntheticEvent, newValue: SidebarView) => {
    onViewChange(newValue);
  };

  return (
    <Box>
      <Tabs
        orientation="vertical"
        value={activeView}
        onChange={handleChange}
        indicatorColor="primary"
        textColor="primary"
        sx={{
          '& .MuiTab-root': {
            justifyContent: 'flex-start',
            minHeight: '50px',
            minWidth: '140px',
            gap: 1,
            px: 2,
            textTransform: 'none',
          },
        }}>
        <Tab value="new" icon={<Icon path={mdiPlus} size={1} />} iconPosition="start" label="New Task" />
        <Tab
          value="tasks"
          icon={<Icon path={mdiClipboardClockOutline} size={1} />}
          iconPosition="start"
          label="Tasks"
        />
        <Tab value="projects" icon={<Icon path={mdiFolderOutline} size={1} />} iconPosition="start" label="Projects" />
        <Tab
          value="layers"
          icon={<Icon path={mdiLayersTripleOutline} size={1} />}
          iconPosition="start"
          label="Layers"
        />
      </Tabs>
    </Box>
  );
};
